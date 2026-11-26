import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, run } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  try {
    const body = await req.json();
    const { moderation_status } = body;
    if (!["approved", "rejected"].includes(moderation_status)) {
      return NextResponse.json({ error: "Invalid moderation status" }, { status: 400 });
    }
    run(db,
      "UPDATE reviews SET moderation_status = ?, moderated_by = ?, moderated_at = datetime('now') WHERE id = ?",
      [moderation_status, auth.user!.id, id]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "review", entity_id: id, action: "moderate", old_value: null, new_value: moderation_status });
    persistDb(db);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to moderate review" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  run(db, "DELETE FROM reviews WHERE id = ?", [id]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "review", entity_id: id, action: "delete", old_value: null, new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
