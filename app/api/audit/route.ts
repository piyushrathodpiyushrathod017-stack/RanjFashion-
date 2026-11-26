import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { getDb, queryAll } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/audit - list audit logs (audit_logs.view) */
export async function GET(req: Request): Promise<Response> {
  const auth = await authorize("audit_logs.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);

  let sql = `SELECT al.*, p.full_name AS actor_name FROM audit_logs al LEFT JOIN profiles p ON p.id = al.actor_id`;
  const params: unknown[] = [];
  if (entity) {
    sql += " WHERE al.entity_type = ?";
    params.push(entity);
  }
  sql += " ORDER BY al.created_at DESC LIMIT ?";
  params.push(limit);

  const rows = queryAll(db, sql, params);
  return NextResponse.json({ logs: rows.map((r) => ({
    id: r.id, actor_id: r.actor_id, actor_name: r.actor_name,
    entity_type: r.entity_type, entity_id: r.entity_id, action: r.action,
    old_value: r.old_value, new_value: r.new_value, created_at: r.created_at,
  })) });
}
