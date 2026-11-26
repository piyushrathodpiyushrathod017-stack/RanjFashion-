import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }
function rowToProduct(r: any) {
  return {
    id: r.id,
    product_code: r.product_code,
    name_en: r.name_en,
    name_gu: r.name_gu,
    slug: r.slug,
    description_en: r.description_en,
    description_gu: r.description_gu,
    category_id: r.category_id,
    category_name: r.category_name,
    purchase_price: r.purchase_price,
    original_price: r.original_price,
    selling_price: r.selling_price,
    discount_percentage: r.discount_percentage,
    overall_availability: r.overall_availability,
    status: r.status,
    is_new_arrival: r.is_new_arrival === 1,
    is_best_seller: r.is_best_seller === 1,
    is_featured: r.is_featured === 1,
    scheduled_publish_at: r.scheduled_publish_at,
    scheduled_unpublish_at: r.scheduled_unpublish_at,
    seo_title: r.seo_title,
    seo_description: r.seo_description,
    created_by: r.created_by,
    updated_by: r.updated_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function computeDiscount(original: number | null, selling: number | null): number | null {
  if (original == null || selling == null || original <= 0) return null;
  return Math.round(((original - selling) / original) * 100);
}

async function getProductWithRelations(db: any, id: string) {
  const prod = queryOne(db,
    `SELECT p.*, c.name_en AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
    [id]) as any | null;
  if (!prod) return null;
  const images = queryAll(db, "SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC, created_at ASC", [id]);
  const variants = queryAll(db, "SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC", [id]);
  const collections = queryAll(db, "SELECT collection_id FROM product_collections WHERE product_id = ?", [id]);
  return {
    product: rowToProduct(prod),
    images: images.map((i) => ({ id: i.id, image_url: i.image_url, alt_text: i.alt_text, display_order: i.display_order, is_main: i.is_main === 1 })),
    variants: variants.map((v) => ({ id: v.id, size: v.size, color: v.color, color_code: v.color_code, price_override: v.price_override, availability: v.availability, image_url: v.image_url, is_active: v.is_active === 1 })),
    collectionIds: collections.map((c) => c.collection_id),
  };
}

/** GET /api/products/[id] - public product detail + staff full detail */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: productId } = await params;
  await ensureDbInitialized();
  const db = await getDb();
  const data = await getProductWithRelations(db, productId);
  if (!data) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const user = await (await import("@/lib/auth-session")).getSessionUser();
  const isStaff = Boolean(user);

  // Privacy: customers must never see purchase price / profit (PRD §6.4, §21)
  if (!isStaff) {
    delete data.product.purchase_price;
  }

  // Record anonymous product view (privacy-conscious, PRD §25.15)
  try {
    run(db, "INSERT INTO product_views (id, product_id, anonymous_session_identifier, created_at) VALUES (?, ?, ?, ?)",
      [id(), productId, id(), new Date().toISOString()]);
    persistDb(db);
  } catch {
    // Views are best-effort; never block product display.
  }

  return NextResponse.json(data);
}

/** PUT /api/products/[id] - update (requires products.edit) */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const existing = queryOne(db, "SELECT * FROM products WHERE id = ?", [id]) as any | null;
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const oldValue = JSON.stringify(rowToProduct(existing));

  try {
    const body = await req.json();
    const {
      product_code, name_en, name_gu, slug, description_en, description_gu,
      category_id, purchase_price, original_price, selling_price,
      discount_percentage, overall_availability, status,
      is_new_arrival, is_best_seller, is_featured,
      scheduled_publish_at, scheduled_unpublish_at,
      seo_title, seo_description,
    } = body;

    const original = original_price !== undefined && original_price !== null ? parseFloat(original_price) : (existing.original_price ? parseFloat(existing.original_price) : null);
    const selling = selling_price !== undefined && selling_price !== null ? parseFloat(selling_price) : (existing.selling_price ? parseFloat(existing.selling_price) : null);
    const calculatedDiscount = computeDiscount(original, selling);
    const discount = discount_percentage !== undefined && discount_percentage !== null ? parseFloat(discount_percentage) : calculatedDiscount;

    run(db,
      `UPDATE products SET product_code=?, name_en=?, name_gu=?, slug=?, description_en=?, description_gu=?, category_id=?, purchase_price=?, original_price=?, selling_price=?, discount_percentage=?, overall_availability=?, status=?, is_new_arrival=?, is_best_seller=?, is_featured=?, scheduled_publish_at=?, scheduled_unpublish_at=?, seo_title=?, seo_description=?, updated_by=?, updated_at=datetime('now') WHERE id=?`,
      [product_code ?? existing.product_code, name_en ?? existing.name_en, name_gu ?? existing.name_gu, slug ?? existing.slug,
        description_en ?? existing.description_en, description_gu ?? existing.description_gu, category_id ?? existing.category_id,
        purchase_price ?? existing.purchase_price, original_price ?? existing.original_price, selling_price ?? existing.selling_price,
        discount !== null ? discount : existing.discount_percentage, overall_availability ?? existing.overall_availability, status ?? existing.status,
        is_new_arrival === true ? 1 : is_new_arrival === false ? 0 : existing.is_new_arrival,
        is_best_seller === true ? 1 : is_best_seller === false ? 0 : existing.is_best_seller,
        is_featured === true ? 1 : is_featured === false ? 0 : existing.is_featured,
        scheduled_publish_at ?? existing.scheduled_publish_at, scheduled_unpublish_at ?? existing.scheduled_unpublish_at,
        seo_title ?? existing.seo_title, seo_description ?? existing.seo_description,
        auth.user!.id, id]);

    await writeAudit({
      actor_id: auth.user!.id, entity_type: "product", entity_id: id, action: "update",
      old_value: oldValue, new_value: JSON.stringify({ name_en, slug, selling_price, discount_percentage: discount }),
    });
    persistDb(db);

    const data = await getProductWithRelations(db, id);
    return NextResponse.json(data);
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) return NextResponse.json({ error: "Product code or slug already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

/** DELETE /api/products/[id] - delete (requires products.delete) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("products.delete");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const existing = queryOne(db, "SELECT * FROM products WHERE id = ?", [id]) as any | null;
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  run(db, "DELETE FROM products WHERE id = ?", [id]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "product", entity_id: id, action: "delete", old_value: JSON.stringify(rowToProduct(existing)), new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
