import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

async function requireProduct(db: any, productId: string) {
  return queryOne(db, "SELECT id FROM products WHERE id = ?", [productId]) as { id: string } | null;
}

/** GET /api/products/[id]/variants - list variants */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  await ensureDbInitialized();
  const db = await getDb();
  const variants = queryAll(db,
    "SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC",
    [id]);
  return NextResponse.json({ variants: variants.map((v) => ({
    id: v.id, size: v.size, color: v.color, color_code: v.color_code,
    price_override: v.price_override, availability: v.availability,
    image_url: v.image_url, is_active: v.is_active === 1,
  })) });
}

/** POST /api/products/[id]/variants - create variant (requires products.edit) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id: productId } = await params;
  const db = await getDb();
  if (!await requireProduct(db, productId)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { size, color, color_code, price_override, availability, image_url, is_active } = body;
    const vid = id();
    const now = new Date().toISOString();
    run(db,
      "INSERT INTO product_variants (id, product_id, size, color, color_code, price_override, availability, image_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [vid, productId, size ?? null, color ?? null, color_code ?? null, price_override ?? null, availability ?? "In Stock", image_url ?? null, is_active === false ? 0 : 1, now]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "product_variant", entity_id: vid, action: "create", old_value: null, new_value: JSON.stringify({ size, color, availability }) });
    persistDb(db);
    return NextResponse.json({ variant: { id: vid, size, color, color_code, price_override, availability: availability ?? "In Stock", image_url, is_active: is_active === false ? 0 : 1 } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create variant" }, { status: 500 });
  }
}
