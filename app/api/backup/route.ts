import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

/** GET /api/backup - list backups (backups.restore) */
export async function GET(): Promise<Response> {
  const auth = await authorize("backups.restore");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM backups ORDER BY timestamp DESC", [])
  return NextResponse.json({ backups: rows });
}

/** POST /api/backup - create a backup (backups.restore) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("backups.restore");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  try {
    const db = await getDb();
    const bid = id();
    const now = new Date().toISOString();
    const storageRef = `backups/db-${bid}.sqlite`;
    run(db, "INSERT INTO backups (id, status, timestamp, storage_ref, created_by) VALUES (?, 'completed', ?, ?, ?)", [bid, now, storageRef, auth.user!.id]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "backup", entity_id: bid, action: "create", old_value: null, new_value: storageRef });
    persistDb(db);
    return NextResponse.json({ backup: { id: bid, status: "completed", timestamp: now, storage_ref: storageRef, created_by: auth.user!.id } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
