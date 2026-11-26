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

/** GET /api/products/[id]/images */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  await ensureDbInitialized();
  const db = await getDb();
  const images = queryAll(db,
    "SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC, created_at ASC",
    [id]);
  return NextResponse.json({ images: images.map((i) => ({
    id: i.id, image_url: i.image_url, alt_text: i.alt_text,
    display_order: i.display_order, is_main: i.is_main === 1,
  })) });
}

/** POST /api/products/[id]/images - add image (requires products.edit) */
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
    const { image_url, alt_text, display_order, is_main } = body;
    const iid = id();
    const now = new Date().toISOString();
    // If setting main, unset other mains
    if (is_main === true) {
      run(db, "UPDATE product_images SET is_main = 0 WHERE product_id = ?", [productId]);
    }
    run(db,
      "INSERT INTO product_images (id, product_id, image_url, alt_text, display_order, is_main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [iid, productId, image_url, alt_text ?? null, Number(display_order ?? 0), is_main === true ? 1 : 0, now]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "product_image", entity_id: iid, action: "create", old_value: null, new_value: JSON.stringify({ image_url }) });
    persistDb(db);
    return NextResponse.json({ image: { id: iid, image_url, alt_text, display_order: Number(display_order ?? 0), is_main: is_main === true ? 1 : 0 } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add image" }, { status: 500 });
  }
}
