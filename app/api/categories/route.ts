import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

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

/** GET /api/categories - list all categories (public) */
export async function GET(): Promise<Response> {
  await ensureDbInitialized();
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM categories ORDER BY display_order ASC, name_en ASC", []);
  return NextResponse.json({ categories: rows.map(rowToCategory) });
}

/** POST /api/categories - create a category (requires categories.manage) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("categories.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  try {
    const body = await req.json();
    const {
      name_en, name_gu, slug, description_en, description_gu,
      image_url, parent_id, display_order, is_active,
    } = body;

    if (!name_en || !slug) {
      return NextResponse.json({ error: "name_en and slug are required" }, { status: 400 });
    }

    const db = await getDb();
    const catId = id();
    const now = new Date().toISOString();
    run(db,
      `INSERT INTO categories (id, name_en, name_gu, slug, description_en, description_gu, image_url, parent_id, display_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [catId, name_en, name_gu ?? null, slug, description_en ?? null,
        description_gu ?? null, image_url ?? null, parent_id ?? null,
        Number(display_order ?? 0), is_active === false ? 0 : 1, now, now]);

    await writeAudit({
      actor_id: auth.user!.id,
      entity_type: "category",
      entity_id: catId,
      action: "create",
      old_value: null,
      new_value: JSON.stringify({ name_en, slug }),
    });
    persistDb(db);

    return NextResponse.json({ category: rowToCategory({ id: catId, name_en, name_gu, slug, description_en, description_gu, image_url, parent_id, display_order: Number(display_order ?? 0), is_active: is_active === false ? 0 : 1 }) }, { status: 201 });
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
