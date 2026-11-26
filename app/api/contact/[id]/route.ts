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
  const auth = await authorize("inquiries.view");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  try {
    const body = await req.json();
    const { status } = body;
    run(db, "UPDATE contact_messages SET status = ? WHERE id = ?", [status, id]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "contact_message", entity_id: id, action: "update", old_value: null, new_value: status });
    persistDb(db);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
