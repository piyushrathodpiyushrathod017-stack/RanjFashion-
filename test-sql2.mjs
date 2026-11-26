import path from "node:path";

async function main() {
  try {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    const result = db.run("INSERT INTO t VALUES (?, ?)", [1, "hello"]);
    console.log("run result:", JSON.stringify(result), "type:", typeof result);
    
    const stmt = db.prepare("SELECT * FROM t WHERE id = ?");
    const bindResult = stmt.bind([1]);
    console.log("bind result:", bindResult, "type:", typeof bindResult);
    const row = stmt.get();
    console.log("get result:", JSON.stringify(row), "type:", typeof row, "isArray:", Array.isArray(row));
    
    // Try all()
    const allRows = [];
    while (true) {
      const r = stmt.get();
      if (!r) break;
      allRows.push(r);
    }
    console.log("all rows:", JSON.stringify(allRows));
    
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
