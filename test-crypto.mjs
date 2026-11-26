import { hashPassword, verifyPassword } from "./lib/crypto";

async function main() {
  const hash = hashPassword("RanjFashion@2026");
  console.log("Hash:", hash);
  const ok = verifyPassword("RanjFashion@2026", hash);
  console.log("Verify correct:", ok);
  const bad = verifyPassword("wrongpassword", hash);
  console.log("Verify wrong:", bad);
}

main();
