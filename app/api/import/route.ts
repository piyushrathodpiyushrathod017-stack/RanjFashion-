import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryOne, run } from "@/lib/db";
import { queryAll } from "@/lib/db";
import * as XLSX from "xlsx";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

/** POST /api/import - import products from CSV or XLSX */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("products.create");
  if (auth.response) return auth.response;
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = auth.user.id;
  await ensureDbInitialized();

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file as File).arrayBuffer) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const f = file as File;
    const bytes = await f.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = f.name.toLowerCase();

    let rows: any[];
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else if (name.endsWith(".csv")) {
      const text = buffer.toString("utf8");
      // Simple CSV parse: header row then data rows
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        return NextResponse.json({ error: "CSV needs a header row and at least one data row" }, { status: 400 });
      }
      const headers = lines[0].split(",").map((h) => h.trim());
      rows = lines.slice(1).map((line) => {
        const vals = line.split(",");
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim(); });
        return obj;
      });
    } else {
      return NextResponse.json({ error: "Only .csv and .xlsx files are supported" }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "File contains no rows" }, { status: 400 });
    }

    const db = await getDb();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const product_code = String(row.product_code || row["Product Code"] || "").trim();
      const slug = String(row.slug || row["Slug"] || "").trim();
      const name_en = String(row.name_en || row["Name"] || "").trim();

      if (!product_code || !name_en || !slug) {
        errors.push(`Row ${rowNum}: missing product_code/name_en/slug`);
        skipped++;
        continue;
      }

      const existing = queryOne(db, "SELECT id FROM products WHERE product_code = ? OR slug = ?", [product_code, slug]);
      if (existing) {
        errors.push(`Row ${rowNum}: duplicate product_code or slug`);
        skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const newId = id();
      const original = row.original_price ? parseFloat(row.original_price) : null;
      const selling = row.selling_price ? parseFloat(row.selling_price) : null;
      let discount = null;
      if (row.discount_percentage !== undefined && row.discount_percentage !== "") {
        discount = parseFloat(row.discount_percentage);
      } else if (original != null && selling != null && original > 0) {
        discount = Math.round(((original - selling) / original) * 100);
      }

      try {
        run(db,
          `INSERT INTO products (id, product_code, name_en, name_gu, slug, description_en, description_gu, category_id, purchase_price, original_price, selling_price, discount_percentage, overall_availability, status, is_new_arrival, is_best_seller, is_featured, created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, product_code, name_en, row.name_gu ?? null, slug, row.description_en ?? null, row.description_gu ?? null,
            row.category_id ?? null, row.purchase_price ?? null, original ?? null, selling ?? null,
            discount, row.overall_availability ?? "In Stock", row.status ?? "active",
            row.is_new_arrival === "true" || row.is_new_arrival === true ? 1 : 0,
            row.is_best_seller === "true" || row.is_best_seller === true ? 1 : 0,
            row.is_featured === "true" || row.is_featured === true ? 1 : 0,
            userId, userId, now, now]);
        imported++;
      } catch (e: any) {
        errors.push(`Row ${rowNum}: ${e?.message || "insert failed"}`);
        skipped++;
      }
    }

    await writeAudit({ actor_id: userId, entity_type: "import", entity_id: "products", action: "create", old_value: null, new_value: JSON.stringify({ imported, skipped, errors: errors.length }) });
    persistDb(db);

    return NextResponse.json({ imported, skipped, errors });
  } catch {
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
