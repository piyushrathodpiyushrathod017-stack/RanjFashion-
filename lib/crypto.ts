import crypto from "node:crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;
const COST = 2 ** 12; // scrypt N parameter (reduced for constrained environments; production should tune upward)

/**
 * Hash a password using scrypt (established, secure password hashing,
 * PRD §21). Returns a portable string: `$scrypt$salt$hash` (hex).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const derived = crypto.scryptSync(password, salt, KEY_LEN, { N: COST });
  return `$scrypt$${salt}$${derived.toString("hex")}`;
}

/** Verify a plaintext password against a stored scrypt hash. */
export function verifyPassword(
  password: string,
  stored: string
): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "scrypt") {
    return false;
  }
  const salt = parts[2];
  const hash = parts[3];
  try {
    const derived = crypto.scryptSync(password, salt, KEY_LEN, { N: COST });
    return derived.toString("hex") === hash;
  } catch {
    return false;
  }
}
