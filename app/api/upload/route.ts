import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** POST /api/upload - upload an image file (requires products.edit) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("products.edit");
  if (auth.response) return auth.response;
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

    // Validate image type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(f.type)) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const ext = f.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const outPath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(outPath, buffer);

    const url = `/uploads/${filename}`;
    await writeAudit({ actor_id: auth.user!.id, entity_type: "upload", entity_id: filename, action: "create", old_value: null, new_value: url });
    const db = await getDb();
    persistDb(db);

    return NextResponse.json({ url, filename }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
