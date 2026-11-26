import crypto from "node:crypto";
import { getDb, persistDb, run } from "./db";

export interface AuditEntry {
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
}

/**
 * Append an immutable audit-log record (PRD §16). Audit records are
 * append-only and protected from unauthorized modification.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  const id = cryptoRandomId();
  run(db,
    `INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id,
      entry.actor_id ?? null,
      entry.entity_type,
      entry.entity_id,
      entry.action,
      entry.old_value ?? null,
      entry.new_value ?? null]);
  persistDb(db);
}

function cryptoRandomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
