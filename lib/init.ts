import { initDatabase } from "./seed";

let initialized = false;

/**
 * Ensure the database schema and default seed data exist.
 * Idempotent: safe to call on every request.
 */
export async function ensureDbInitialized(): Promise<void> {
  if (initialized) return;
  await initDatabase();
  initialized = true;
}
