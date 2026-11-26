import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryOne, run } from "@/lib/db";

export const runtime = "nodejs";

function rowToCollection(r: any) {
  return {
    id: r.id,
    name_en: r.name_en,
    name_gu: r.name_gu,
    slug: r.slug,
    description_en: r.description_en,
    description_gu: r.description_gu,
    banner_url: r.banner_url,
    display_order: r.display_order,
    is_active: r.is_active === 1,
  };
}

async function getCollection(db: any, id: string) {
  return queryOne(db, "SELECT * FROM collections WHERE id = ?", [id]) as any | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  await ensureDbInitialized();
  const db = await getDb();
  const col = await getCollection(db, id);
  if (!col) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  return NextResponse.json({ collection: rowToCollection(col) });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("collections.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const existing = await getCollection(db, id);
  if (!existing) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  const oldValue = JSON.stringify(rowToCollection(existing));
  try {
    const body = await req.json();
    const { name_en, name_gu, slug, description_en, description_gu, banner_url, display_order, is_active } = body;
    run(db,
      `UPDATE collections SET name_en=?, name_gu=?, slug=?, description_en=?, description_gu=?, banner_url=?, display_order=?, is_active=?, updated_at=datetime('now') WHERE id=?`,
      [name_en ?? existing.name_en, name_gu ?? existing.name_gu, slug ?? existing.slug, description_en ?? existing.description_en, description_gu ?? existing.description_gu, banner_url ?? existing.banner_url, Number(display_order ?? existing.display_order), is_active === false ? 0 : existing.is_active, id]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "collection", entity_id: id, action: "update", old_value: oldValue, new_value: JSON.stringify({ name_en, slug }) });
    persistDb(db);
    const updated = await getCollection(db, id);
    return NextResponse.json({ collection: rowToCollection(updated!) });
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("collections.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const existing = await getCollection(db, id);
  if (!existing) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  run(db, "DELETE FROM collections WHERE id = ?", [id]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "collection", entity_id: id, action: "delete", old_value: JSON.stringify(rowToCollection(existing)), new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
