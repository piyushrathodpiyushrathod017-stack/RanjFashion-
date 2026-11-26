import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

function notifRow(r: any) {
  return { id: r.id, type: r.type, title: r.title, message: r.message, is_read: r.is_read === 1, created_at: r.created_at };
}

/** GET /api/notifications - list notifications (staff) */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorize("analytics.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  let sql = "SELECT * FROM notifications";
  const params: unknown[] = [];
  if (unreadOnly) { sql += " WHERE is_read = 0"; }
  sql += " ORDER BY created_at DESC";
  const rows = queryAll(db, sql, params);
  return NextResponse.json({ notifications: rows.map(notifRow) });
}

/** POST /api/notifications - create notification (staff/system) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("settings.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { type, title, message } = body;
    if (!type || !title || !message) return NextResponse.json({ error: "type, title and message required" }, { status: 400 });
    const db = await getDb();
    const nid = id();
    const now = new Date().toISOString();
    run(db, "INSERT INTO notifications (id, type, title, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)", [nid, type, title, message, now]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "notification", entity_id: nid, action: "create", old_value: null, new_value: title });
    persistDb(db);
    return NextResponse.json({ notification: notifRow({ id: nid, type, title, message, is_read: 0, created_at: now }) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}
