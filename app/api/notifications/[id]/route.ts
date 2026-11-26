import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, run } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("analytics.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  run(db, "UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "notification", entity_id: id, action: "read", old_value: null, new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
