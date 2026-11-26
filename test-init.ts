import { initDatabase } from "./lib/seed";

async function main() {
  try {
    await initDatabase();
    console.log("Database initialized successfully");
  } catch (e: any) {
    console.error("Error:", e.message);
    console.error(e.stack);
  }
}

main();
