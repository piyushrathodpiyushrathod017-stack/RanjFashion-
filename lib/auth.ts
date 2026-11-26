import crypto from "node:crypto";
import { getDb, persistDb, queryOne, run } from "./db";
import { hashPassword, verifyPassword } from "./crypto";
import { createSession, deleteSessionsForUser } from "./session";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
}

/** Authenticate a staff member by email + password. Returns user or null. */
export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const db = await getDb();
  const row = queryOne(db,
    `SELECT p.id, p.full_name, p.email, p.password_hash, p.role_id, p.is_active, r.name AS role_name
     FROM profiles p JOIN roles r ON r.id = p.role_id
     WHERE p.email = ?`,
    [email]) as { id: string; full_name: string; email: string; password_hash: string; role_id: string; role_name: string; is_active: number } | null;

  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  if (!row.is_active) return null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role_id: row.role_id,
    role_name: row.role_name,
    is_active: row.is_active === 1,
  };
}

/** Create a staff account (owner/super admin only). */
export async function createStaffAccount(data: {
  full_name: string;
  email: string;
  password: string;
  role_id: string;
}): Promise<{ id: string } | { error: string }> {
  const db = await getDb();
  const exists = queryOne(db, "SELECT id FROM profiles WHERE email = ?", [data.email]);
  if (exists) return { error: "Email already registered" };

  const newId = cryptoRandomId();
  const password_hash = hashPassword(data.password);
  run(db,
    `INSERT INTO profiles (id, full_name, email, password_hash, role_id) VALUES (?, ?, ?, ?, ?)`,
    [newId, data.full_name, data.email, password_hash, data.role_id]);
  persistDb(db);
  return { id: newId };
}

/** Get user by id. */
export async function getUserById(userId: string): Promise<User | null> {
  const db = await getDb();
  const row = queryOne(db,
    `SELECT p.id, p.full_name, p.email, p.role_id, p.is_active, r.name AS role_name
     FROM profiles p JOIN roles r ON r.id = p.role_id
     WHERE p.id = ?`,
    [userId]) as { id: string; full_name: string; email: string; role_id: string; role_name: string; is_active: number } | null;
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role_id: row.role_id,
    role_name: row.role_name,
    is_active: row.is_active === 1,
  };
}

/** Change a user's password. */
export async function changePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const db = await getDb();
  const password_hash = hashPassword(newPassword);
  run(db,
    "UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    [password_hash, userId]);
  // Invalidate all other sessions so the user must re-login elsewhere.
  deleteSessionsForUser(userId);
  persistDb(db);
}

function cryptoRandomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
