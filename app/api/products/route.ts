import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

function computeDiscount(original: number | null, selling: number | null): number | null {
  if (original == null || selling == null || original <= 0) return null;
  return Math.round(((original - selling) / original) * 100);
}

function productRowToProduct(r: any) {
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

/**
 * GET /api/products
 * Public listing with filters. Authenticated staff can see all statuses.
 */
export async function GET(req: Request): Promise<Response> {
  await ensureDbInitialized();
  const db = await getDb();
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category");
  const collection = searchParams.get("collection");
  const q = searchParams.get("q");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const size = searchParams.get("size");
  const color = searchParams.get("color");
  const availability = searchParams.get("availability");
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
  const isNewArrival = searchParams.get("isNewArrival");
  const isBestSeller = searchParams.get("isBestSeller");
  const isFeatured = searchParams.get("isFeatured");
  const statusFilter = searchParams.get("status");

  const user = await (await import("@/lib/auth-session")).getSessionUser();
  const isStaff = Boolean(user);

  const params: unknown[] = [];
  let where = "1=1";
  const add = (sql: string, val: unknown) => { where += ` AND ${sql}`; params.push(val); };

  // Visibility rules (PRD: public sees only active, published products)
  if (!isStaff) {
    where += ` AND p.status = 'active'`;
    where += ` AND (p.scheduled_publish_at IS NULL OR p.scheduled_publish_at <= ?)`;
    params.push(nowIso());
    where += ` AND (p.scheduled_unpublish_at IS NULL OR p.scheduled_unpublish_at > ?)`;
    params.push(nowIso());
  } else if (statusFilter) {
    add("p.status = ?", statusFilter);
  }

  if (category) add("p.category_id = ? OR (SELECT slug FROM categories WHERE id = p.category_id) = ?", category);
  if (collection) {
    where += ` AND p.id IN (SELECT product_id FROM product_collections WHERE collection_id = ?)`;
    params.push(collection);
  }
  if (q) {
    where += ` AND (p.name_en LIKE ? OR p.name_gu LIKE ? OR p.product_code LIKE ? OR p.slug LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (minPrice) add("CAST(p.selling_price AS REAL) >= ?", parseFloat(minPrice));
  if (maxPrice) add("CAST(p.selling_price AS REAL) <= ?", parseFloat(maxPrice));
  if (size) {
    where += ` AND p.id IN (SELECT product_id FROM product_variants WHERE is_active=1 AND (size = ? OR ? = ''))`;
    params.push(size, size);
  }
  if (color) {
    where += ` AND p.id IN (SELECT product_id FROM product_variants WHERE is_active=1 AND (color = ? OR ? = ''))`;
    params.push(color, color);
  }
  if (availability) add("p.overall_availability = ?", availability);
  if (isNewArrival !== null && isNewArrival !== undefined) add("p.is_new_arrival = ?", isNewArrival === "true" ? 1 : 0);
  if (isBestSeller !== null && isBestSeller !== undefined) add("p.is_best_seller = ?", isBestSeller === "true" ? 1 : 0);
  if (isFeatured !== null && isFeatured !== undefined) add("p.is_featured = ?", isFeatured === "true" ? 1 : 0);

  // Sort
  let orderBy = "p.created_at DESC";
  if (sort === "price_asc") orderBy = "CAST(p.selling_price AS REAL) ASC";
  else if (sort === "price_desc") orderBy = "CAST(p.selling_price AS REAL) DESC";
  else if (sort === "discount") orderBy = "CAST(p.discount_percentage AS REAL) DESC";
  else if (sort === "popular") {
    orderBy = `(COALESCE((SELECT COUNT(*) FROM product_views v WHERE v.product_id = p.id),0) + COALESCE((SELECT COUNT(*) FROM inquiries i WHERE i.product_id = p.id),0)) DESC`;
  }

  const offset = (page - 1) * limit;
  const rows = queryAll(db,
    `SELECT p.*, c.name_en AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]);

  const countRow = queryOne(db, `SELECT COUNT(*) AS c FROM products p WHERE ${where}`, params) as { c: number } | null;
  const total = countRow?.c ?? 0;

  return NextResponse.json({
    products: rows.map(productRowToProduct),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** POST /api/products - create a product (requires products.create) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("products.create");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  try {
    const body = await req.json();
    const {
      product_code, name_en, name_gu, slug, description_en, description_gu,
      category_id, purchase_price, original_price, selling_price,
      discount_percentage, overall_availability, status,
      is_new_arrival, is_best_seller, is_featured,
      scheduled_publish_at, scheduled_unpublish_at,
      seo_title, seo_description,
      collections, images, variants,
    } = body;

    if (!product_code || !name_en || !slug) {
      return NextResponse.json({ error: "product_code, name_en and slug are required" }, { status: 400 });
    }

    const original = original_price ? parseFloat(original_price) : null;
    const selling = selling_price ? parseFloat(selling_price) : null;
    const calculatedDiscount = computeDiscount(original, selling);
    const discount = discount_percentage !== undefined && discount_percentage !== null
      ? parseFloat(discount_percentage)
      : calculatedDiscount;

    const db = await getDb();
    const prodId = id();
    const now = nowIso();
    run(db,
      `INSERT INTO products (id, product_code, name_en, name_gu, slug, description_en, description_gu, category_id, purchase_price, original_price, selling_price, discount_percentage, overall_availability, status, is_new_arrival, is_best_seller, is_featured, scheduled_publish_at, scheduled_unpublish_at, seo_title, seo_description, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prodId, product_code, name_en, name_gu ?? null, slug, description_en ?? null, description_gu ?? null,
        category_id ?? null, purchase_price ?? null, original_price ?? null, selling_price ?? null,
        discount !== null ? discount : null, overall_availability ?? "In Stock", status ?? "active",
        is_new_arrival === true ? 1 : 0, is_best_seller === true ? 1 : 0, is_featured === true ? 1 : 0,
        scheduled_publish_at ?? null, scheduled_unpublish_at ?? null, seo_title ?? null, seo_description ?? null,
        auth.user!.id, auth.user!.id, now, now]);

    // Collections
    if (Array.isArray(collections)) {
      for (const colId of collections) {
        run(db, "INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)", [prodId, colId]);
      }
    }

    // Images
    if (Array.isArray(images)) {
      let mainSet = false;
      for (const img of images) {
        const isMain = img.is_main === true && !mainSet ? 1 : 0;
        if (img.is_main === true) mainSet = true;
        run(db,
          "INSERT INTO product_images (id, product_id, image_url, alt_text, display_order, is_main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [id(), prodId, img.image_url, img.alt_text ?? null, Number(img.display_order ?? 0), isMain, now]);
      }
    }

    // Variants
    if (Array.isArray(variants)) {
      for (const v of variants) {
        run(db,
          "INSERT INTO product_variants (id, product_id, size, color, color_code, price_override, availability, image_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id(), prodId, v.size ?? null, v.color ?? null, v.color_code ?? null, v.price_override ?? null, v.availability ?? "In Stock", v.image_url ?? null, v.is_active === false ? 0 : 1, now]);
      }
    }

    await writeAudit({
      actor_id: auth.user!.id,
      entity_type: "product",
      entity_id: prodId,
      action: "create",
      old_value: null,
      new_value: JSON.stringify({ product_code, name_en, slug }),
    });
    persistDb(db);

    return NextResponse.json({ product: productRowToProduct({ id: prodId, product_code, name_en, name_gu, slug, description_en, description_gu, category_id, purchase_price, original_price, selling_price, discount_percentage: discount, overall_availability: overall_availability ?? "In Stock", status: status ?? "active", is_new_arrival: is_new_arrival === true ? 1 : 0, is_best_seller: is_best_seller === true ? 1 : 0, is_featured: is_featured === true ? 1 : 0, scheduled_publish_at: scheduled_publish_at ?? null, scheduled_unpublish_at: scheduled_unpublish_at ?? null, seo_title: seo_title ?? null, seo_description: seo_description ?? null, created_by: auth.user!.id, updated_by: auth.user!.id, created_at: now, updated_at: now, category_name: null }) }, { status: 201 });
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Product code or slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
