const crypto = require("node:crypto");

const SALT_LEN = 16;
const KEY_LEN = 32;
const COST = 2 ** 12;

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const derived = crypto.scryptSync(password, salt, KEY_LEN, { N: COST });
  return `$scrypt${salt}${derived.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "scrypt") return false;
  const salt = parts[2];
  const hash = parts[3];
  try {
    const derived = crypto.scryptSync(password, salt, KEY_LEN, { N: COST });
    return derived.toString("hex") === hash;
  } catch {
    return false;
  }
}

const hash = hashPassword("RanjFashion@2026");
console.log("Hash:", hash);
console.log("Verify correct:", verifyPassword("RanjFashion@2026", hash));
console.log("Verify wrong:", verifyPassword("wrongpassword", hash));
