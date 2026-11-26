import path from "node:path";

async function main() {
  try {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'hello')");
    
    const stmt = db.prepare("SELECT * FROM t WHERE id = ?");
    stmt.bind([1]);
    const row = stmt.get();
    console.log("get result:", JSON.stringify(row), "type:", typeof row, "isArray:", Array.isArray(row), "length:", row?.length);
    
    // Now test with no match
    stmt.bind([999]);
    const row2 = stmt.get();
    console.log("no match result:", JSON.stringify(row2), "type:", typeof row2);
    
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
