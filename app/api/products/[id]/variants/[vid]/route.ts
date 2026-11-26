import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryOne, run } from "@/lib/db";

export const runtime = "nodejs";

async function getVariant(db: any, vid: string) {
  return queryOne(db, "SELECT * FROM product_variants WHERE id = ?", [vid]) as any | null;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { vid } = await params;
  const db = await getDb();
  const existing = await getVariant(db, vid);
  if (!existing) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  const oldValue = JSON.stringify(existing);
  try {
    const body = await req.json();
    const { size, color, color_code, price_override, availability, image_url, is_active } = body;
    run(db,
      "UPDATE product_variants SET size=?, color=?, color_code=?, price_override=?, availability=?, image_url=?, is_active=? WHERE id=?",
      [size ?? existing.size, color ?? existing.color, color_code ?? existing.color_code, price_override ?? existing.price_override, availability ?? existing.availability, image_url ?? existing.image_url, is_active === false ? 0 : is_active === true ? 1 : existing.is_active, vid]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "product_variant", entity_id: vid, action: "update", old_value: oldValue, new_value: JSON.stringify({ size, color, availability }) });
    persistDb(db);
    return NextResponse.json({ variant: { ...existing, size: size ?? existing.size, color: color ?? existing.color, availability: availability ?? existing.availability } });
  } catch {
    return NextResponse.json({ error: "Failed to update variant" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; vid: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { vid } = await params;
  const db = await getDb();
  const existing = await getVariant(db, vid);
  if (!existing) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  run(db, "DELETE FROM product_variants WHERE id = ?", [vid]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "product_variant", entity_id: vid, action: "delete", old_value: JSON.stringify(existing), new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
