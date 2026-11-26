import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryAll, queryOne, run } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import crypto from "node:crypto";

export const runtime = "nodejs";

function id() { return crypto.randomUUID(); }

function staffRow(r: any) {
  return { id: r.id, full_name: r.full_name, email: r.email, role_id: r.role_id, is_active: r.is_active === 1, created_at: r.created_at, updated_at: r.updated_at };
}

/** GET /api/staff - list staff (staff.manage) */
export async function GET(): Promise<Response> {
  const auth = await authorize("staff.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  const db = await getDb();
  const rows = queryAll(db,
    `SELECT p.id, p.full_name, p.email, p.role_id, p.is_active, p.created_at, p.updated_at, r.name AS role_name FROM profiles p JOIN roles r ON r.id = p.role_id ORDER BY p.created_at DESC`,
    []);
  return NextResponse.json({ staff: rows.map(staffRow) });
}

/** POST /api/staff - create staff account (staff.manage) */
export async function POST(req: Request): Promise<Response> {
  const auth = await authorize("staff.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();
  try {
    const body = await req.json();
    const { full_name, email, password, role_id } = body;
    if (!full_name || !email || !password || !role_id) {
      return NextResponse.json({ error: "full_name, email, password and role_id are required" }, { status: 400 });
    }
    const db = await getDb();
    const exists = queryOne(db, "SELECT id FROM profiles WHERE email = ?", [email]);
    if (exists) return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    const sid = id();
    const now = new Date().toISOString();
    run(db,
      "INSERT INTO profiles (id, full_name, email, password_hash, role_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      [sid, full_name, email, hashPassword(password), role_id, now, now]);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "staff", entity_id: sid, action: "create", old_value: null, new_value: JSON.stringify({ email, role_id }) });
    persistDb(db);
    return NextResponse.json({ staff: staffRow({ id: sid, full_name, email, role_id, is_active: 1, created_at: now, updated_at: now }) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 });
  }
}
