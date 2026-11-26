import path from "node:path";
import fs from "node:fs";

async function main() {
  try {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    
    // Read schema
    const schemaSrc = fs.readFileSync(path.join(process.cwd(), "lib/schema.ts"), "utf8");
    const start = schemaSrc.indexOf("`");
    const end = schemaSrc.lastIndexOf("`");
    const sql = schemaSrc.slice(start + 1, end);
    
    const db = new SQL.Database();
    db.exec(sql);
    console.log("Schema executed OK");
    
    // Test a simple insert
    db.run("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)", ["r1", "Test", "desc"]);
    console.log("Insert OK");
    
    // Test queryOne
    const stmt = db.prepare("SELECT * FROM roles WHERE id = ?");
    stmt.bind(["r1"]);
    const row = stmt.get();
    console.log("Query result:", JSON.stringify(row));
    
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
