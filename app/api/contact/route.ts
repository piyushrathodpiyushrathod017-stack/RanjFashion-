import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

function contactRow(r: any) {
  return { id: r.id, name: r.name, mobile: r.mobile, message: r.message, status: r.status, created_at: r.created_at };
}

/** GET /api/contact - list messages (staff only) */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorize("inquiries.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM contact_messages ORDER BY created_at DESC", [])
  return NextResponse.json({ messages: rows.map(contactRow) });
}

/** POST /api/contact - submit contact form (public, with spam protection) */
export async function POST(req: Request): Promise<Response> {
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { name, mobile, message } = body;
    if (!name || !mobile || !message) {
      return NextResponse.json({ error: "name, mobile and message are required" }, { status: 400 });
    }

    const db = await getDb();
    const cid = id();
    const now = new Date().toISOString();
    run(db,
      "INSERT INTO contact_messages (id, name, mobile, message, status, created_at) VALUES (?, ?, ?, ?, 'new', ?)",
      [cid, name, mobile, message, now]);

    await writeAudit({ actor_id: null, entity_type: "contact_message", entity_id: cid, action: "create", old_value: null, new_value: JSON.stringify({ name }) });
    persistDb(db);

    return NextResponse.json({ ok: true, message: "Message received. We will contact you via WhatsApp." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit message" }, { status: 500 });
  }
}
