import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

function popupRow(r: any) {
  return {
    id: r.id, heading: r.heading, description: r.description, image_url: r.image_url,
    link: r.link, start_at: r.start_at, end_at: r.end_at, is_active: r.is_active === 1,
    frequency_control: r.frequency_control, created_at: r.created_at, updated_at: r.updated_at,
  };
}

/** GET /api/popups - active popups (public) */
export async function GET(req: Request): Promise<Response> {
  await ensureDbInitialized();
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") !== "false";
  let sql = "SELECT * FROM promotional_popups";
  const params: unknown[] = [];
  if (activeOnly) {
    sql += " WHERE is_active = 1 AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at > ?)";
    params.push(nowIso(), nowIso());
  }
  sql += " ORDER BY created_at DESC";
  const rows = queryAll(db, sql, params);
  return NextResponse.json({ popups: rows.map(popupRow) });
}

/** POST /api/popups - create (staff) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { heading, description, image_url, link, start_at, end_at, is_active, frequency_control } = body;
    if (!heading) return NextResponse.json({ error: "heading required" }, { status: 400 });
    const db = await getDb();
    const pid = id();
    const now = nowIso();
    run(db,
      `INSERT INTO promotional_popups (id, heading, description, image_url, link, start_at, end_at, is_active, frequency_control, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pid, heading, description ?? null, image_url ?? null, link ?? null, start_at ?? null, end_at ?? null, is_active === false ? 0 : 1, frequency_control ?? "session", now, now]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "popup", entity_id: pid, action: "create", old_value: null, new_value: heading });
    persistDb(db);
    return NextResponse.json({ popup: popupRow({ id: pid, heading, description, image_url, link, start_at, end_at, is_active: is_active === false ? 0 : 1, frequency_control: frequency_control ?? "session", created_at: now, updated_at: now }) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create popup" }, { status: 500 });
  }
}
