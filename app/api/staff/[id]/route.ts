import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/init";
import { authorize } from "@/lib/authorize";
import { writeAudit } from "@/lib/audit";
import { getDb, persistDb, queryOne, run } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export const runtime = "nodejs";

function staffRow(r: any) {
  return { id: r.id, full_name: r.full_name, email: r.email, role_id: r.role_id, is_active: r.is_active === 1, created_at: r.created_at, updated_at: r.updated_at };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("staff.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  const r = queryOne(db,
    `SELECT p.id, p.full_name, p.email, p.role_id, p.is_active, p.created_at, p.updated_at, r.name AS role_name FROM profiles p JOIN roles r ON r.id = p.role_id WHERE p.id = ?`,
    [id]);
  if (!r) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json({ staff: staffRow(r) });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("staff.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  try {
    const body = await req.json();
    const { full_name, email, role_id, is_active, password } = body;
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (full_name !== undefined) { updates.push("full_name = ?"); vals.push(full_name); }
    if (email !== undefined) { updates.push("email = ?"); vals.push(email); }
    if (role_id !== undefined) { updates.push("role_id = ?"); vals.push(role_id); }
    if (is_active !== undefined) { updates.push("is_active = ?"); vals.push(is_active === true ? 1 : 0); }
    if (password) { updates.push("password_hash = ?"); vals.push(hashPassword(password)); }
    if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    updates.push("updated_at = datetime('now')");
    vals.push(id);
    run(db, `UPDATE profiles SET ${updates.join(", ")} WHERE id = ?`, vals);
    await writeAudit({ actor_id: auth.user!.id, entity_type: "staff", entity_id: id, action: "update", old_value: null, new_value: JSON.stringify(body) });
    persistDb(db);
    const r = queryOne(db, "SELECT * FROM profiles WHERE id = ?", [id]);
    return NextResponse.json({ staff: staffRow(r) });
  } catch {
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await authorize("staff.manage");
  if (auth.response) return auth.response;
  await ensureDbInitialized();

  const { id } = await params;
  const db = await getDb();
  run(db, "DELETE FROM profiles WHERE id = ?", [id]);
  await writeAudit({ actor_id: auth.user!.id, entity_type: "staff", entity_id: id, action: "delete", old_value: null, new_value: null });
  persistDb(db);
  return NextResponse.json({ ok: true });
}
