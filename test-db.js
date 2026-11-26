const path = require("path");
const fs = require("fs");

async function main() {
  const SQL = await require("sql.js")({
    locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
  });
  const fs_ = fs;
  const DATA_DIR = path.join(process.cwd(), "data");
  const DB_PATH = path.join(DATA_DIR, "dev.sqlite");
  fs_.mkdirSync(DATA_DIR, { recursive: true });

  const schema = fs_.readFileSync(path.join(process.cwd(), "lib/schema.ts"), "utf8");

  // Extract just the SQL between backticks
  const start = schema.indexOf("`");
  const end = schema.lastIndexOf("`");
  const sql = schema.slice(start + 1, end);

  console.log("SQL length:", sql.length);
  console.log("First 200 chars:", sql.slice(0, 200));

  const db = new SQL.Database();
  try {
    db.exec(sql);
    console.log("Schema executed successfully");

    // Test a simple query
    db.run("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)", ["r1", "Test Role", "desc"]);
    const rows = db.prepare("SELECT * FROM roles").bind(["r1"]).get();
    console.log("Insert test:", JSON.stringify(rows));
  } catch (e) {
    console.error("DB error:", e.message);
  }
}

main();
