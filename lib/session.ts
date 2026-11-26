import crypto from "node:crypto";
import { getDb, persistDb, queryOne, run } from "./db";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function nowIso(): string {
  return new Date().toISOString();
}

function addTtl(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const id = cryptoRandomId();
  run(db,
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [id, userId, addTtl(SESSION_TTL_MS)]);
  persistDb(db);
  return id;
}

export async function getSession(sessionId: string): Promise<{
  userId: string;
  expiresAt: string;
} | null> {
  const db = await getDb();
  const row = queryOne(db,
    "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    [sessionId]) as { user_id: string; expires_at: string } | null;
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await deleteSession(sessionId);
    return null;
  }
  return { userId: row.user_id, expiresAt: row.expires_at };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  run(db, "DELETE FROM sessions WHERE id = ?", [sessionId]);
  persistDb(db);
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  const db = await getDb();
  run(db, "DELETE FROM sessions WHERE user_id = ?", [userId]);
  persistDb(db);
}

export async function cleanupExpiredSessions(): Promise<void> {
  const db = await getDb();
  run(db, "DELETE FROM sessions WHERE expires_at <= ?", [new Date().toISOString()]);
  persistDb(db);
}

function cryptoRandomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
