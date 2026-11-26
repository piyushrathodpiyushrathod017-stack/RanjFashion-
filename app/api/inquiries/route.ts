import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

function inquiryRow(r: any) {
  return {
    id: r.id,
    product_id: r.product_id,
    product_name_snapshot: r.product_name_snapshot,
    selected_size: r.selected_size,
    selected_color: r.selected_color,
    displayed_price: r.displayed_price,
    event_id: r.event_id,
    created_at: r.created_at,
  };
}

/** GET /api/inquiries - list inquiries (requires inquiries.view) */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorize("inquiries.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const product = searchParams.get("product");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);

  let where = "1=1";
  const params: unknown[] = [];
  const add = (sql: string, val: unknown) => { where += ` AND ${sql}`; params.push(val); };
  if (product) { add("product_id = ? OR product_name_snapshot LIKE ?", product); params.push(product, `%${product}%`); }
  if (from) { add("created_at >= ?", from); }
  if (to) { add("created_at <= ?", to); }

  const offset = (page - 1) * limit;
  const rows = queryAll(db,
    `SELECT * FROM inquiries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const countRow = queryOne(db, `SELECT COUNT(*) AS c FROM inquiries WHERE ${where}`, params) as { c: number } | null;

  return NextResponse.json({
    inquiries: rows.map(inquiryRow),
    pagination: { page, limit, total: countRow?.c ?? 0, totalPages: Math.ceil((countRow?.c ?? 0) / limit) },
  });
}

/** POST /api/inquiries - record a WhatsApp inquiry click (public) */
export async function POST(req: Request): Promise<Response> {
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const {
      product_id, product_name_snapshot, selected_size, selected_color,
      displayed_price, event_id,
    } = body;

    if (!product_name_snapshot || !event_id) {
      return NextResponse.json({ error: "product_name_snapshot and event_id are required" }, { status: 400 });
    }

    const db = await getDb();
    const iid = id();
    const now = nowIso();
    run(db,
      `INSERT INTO inquiries (id, product_id, product_name_snapshot, selected_size, selected_color, displayed_price, event_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [iid, product_id ?? null, product_name_snapshot, selected_size ?? null, selected_color ?? null, displayed_price ?? null, event_id, now]);
    persistDb(db);

    return NextResponse.json({ inquiry: inquiryRow({ id: iid, product_id, product_name_snapshot, selected_size, selected_color, displayed_price, event_id, created_at: now }) }, { status: 201 });
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Duplicate inquiry event" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to record inquiry" }, { status: 500 });
  }
}
