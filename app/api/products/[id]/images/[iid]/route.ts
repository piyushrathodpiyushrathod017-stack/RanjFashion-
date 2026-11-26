import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryOne, run } from "@/lib/db";

export const runtime = "nodejs";

async function getImage(db: any, iid: string) {
  return queryOne(db, "SELECT * FROM product_images WHERE id = ?", [iid]) as any | null;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; iid: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { iid } = await params;
  const db = await getDb();
  const existing = await getImage(db, iid);
  if (!existing) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  try {
    const body = await req.json();
    const { image_url, alt_text, display_order, is_main } = body;
    if (is_main === true) {
      run(db, "UPDATE product_images SET is_main = 0 WHERE product_id = ?", [existing.product_id]);
    }
    run(db,
      "UPDATE product_images SET image_url=?, alt_text=?, display_order=?, is_main=? WHERE id=?",
      [image_url ?? existing.image_url, alt_text ?? existing.alt_text, Number(display_order ?? existing.display_order), is_main === true ? 1 : is_main === false ? 0 : existing.is_main, iid]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "product_image", entity_id: iid, action: "update", old_value: JSON.stringify(existing), new_value: JSON.stringify(body) });
    persistDb(db);
    return NextResponse.json({ image: { ...existing, image_url: image_url ?? existing.image_url, is_main: is_main === true ? 1 : existing.is_main } });
  } catch {
    return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; iid: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { iid } = await params;
  const db = await getDb();
  const existing = await getImage(db, iid);
  if (!existing) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  run(db, "DELETE FROM product_images WHERE id = ?", [iid]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "product_image", entity_id: iid, action: "delete", old_value: JSON.stringify(existing), new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
