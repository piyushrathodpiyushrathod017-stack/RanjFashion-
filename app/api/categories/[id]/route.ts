import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryOne, run } from "@/lib/db";

export const runtime = "nodejs";

function rowToCategory(r: any) {
  return {
    id: r.id,
    name_en: r.name_en,
    name_gu: r.name_gu,
    slug: r.slug,
    description_en: r.description_en,
    description_gu: r.description_gu,
    image_url: r.image_url,
    parent_id: r.parent_id,
    display_order: r.display_order,
    is_active: r.is_active === 1,
  };
}

async function getCategory(db: any, id: string) {
  return queryOne(db, "SELECT * FROM categories WHERE id = ?", [id]) as any | null;
}

/** GET /api/categories/[id] */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  await ensureDbInitialized();
  const db = await getDb();
  const cat = await getCategory(db, id);
  if (!cat) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  return NextResponse.json({ category: rowToCategory(cat) });
}

/** PUT /api/categories/[id] (requires categories.manage) */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("categories.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const existing = await getCategory(db, id);
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  const oldValue = JSON.stringify(rowToCategory(existing));

  try {
    const body = await req.json();
    const {
      name_en, name_gu, slug, description_en, description_gu,
      image_url, parent_id, display_order, is_active,
    } = body;

    run(db,
      `UPDATE categories SET name_en=?, name_gu=?, slug=?, description_en=?, description_gu=?, image_url=?, parent_id=?, display_order=?, is_active=?, updated_at=datetime('now') WHERE id=?`,
      [name_en ?? existing.name_en, name_gu ?? existing.name_gu, slug ?? existing.slug,
        description_en ?? existing.description_en, description_gu ?? existing.description_gu,
        image_url ?? existing.image_url, parent_id ?? existing.parent_id,
        Number(display_order ?? existing.display_order),
        is_active === false ? 0 : existing.is_active,
        id]);

    await writeAudit({
      actor_id: auth.user!.id,
      entity_type: "category",
      entity_id: id,
      action: "update",
      old_value: oldValue,
      new_value: JSON.stringify({ name_en, slug }),
    });
    persistDb(db);

    const updated = await getCategory(db, id);
    return NextResponse.json({ category: rowToCategory(updated!) });
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

/** DELETE /api/categories/[id] (requires categories.manage) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("categories.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const existing = await getCategory(db, id);
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  run(db, "DELETE FROM categories WHERE id = ?", [id]);
  await writeAudit({
    actor_id: auth.user!.id,
    entity_type: "category",
    entity_id: id,
    action: "delete",
    old_value: JSON.stringify(rowToCategory(existing)),
    new_value: null,
  });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
