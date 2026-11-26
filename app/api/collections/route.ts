import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, run } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

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

/** GET /api/collections - list all collections (public) */
export async function GET(): Promise<Response> {
  await ensureDbInitialized();
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM collections ORDER BY display_order ASC, name_en ASC", []);
  return NextResponse.json({ collections: rows.map(rowToCollection) });
}

/** POST /api/collections - create (requires collections.manage) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("collections.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  try {
    const body = await req.json();
    const { name_en, name_gu, slug, description_en, description_gu, banner_url, display_order, is_active } = body;
    if (!name_en || !slug) {
      return NextResponse.json({ error: "name_en and slug are required" }, { status: 400 });
    }
    const db = await getDb();
    const colId = id();
    const now = new Date().toISOString();
    run(db,
      `INSERT INTO collections (id, name_en, name_gu, slug, description_en, description_gu, banner_url, display_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [colId, name_en, name_gu ?? null, slug, description_en ?? null, description_gu ?? null, banner_url ?? null, Number(display_order ?? 0), is_active === false ? 0 : 1, now, now]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "collection", entity_id: colId, action: "create", old_value: null, new_value: JSON.stringify({ name_en, slug }) });
    persistDb(db);
    return NextResponse.json({ collection: rowToCollection({ id: colId, name_en, name_gu, slug, description_en, description_gu, banner_url, display_order: Number(display_order ?? 0), is_active: is_active === false ? 0 : 1 }) }, { status: 201 });
  } catch (err: any) {
    if (err?.message && err.message.includes("UNIQUE constraint")) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
