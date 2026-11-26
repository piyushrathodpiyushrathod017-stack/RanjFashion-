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
    
    // Try getAsObject
    const stmt = db.prepare("SELECT * FROM t WHERE id = ?");
    stmt.bind([1]);
    const obj = stmt.getAsObject();
    console.log("getAsObject:", JSON.stringify(obj));
    
    // Try step + get
    const stmt2 = db.prepare("SELECT * FROM t WHERE id = ?");
    stmt2.bind([1]);
    const hasRow = stmt2.step();
    console.log("step result:", hasRow);
    const row = stmt2.get();
    console.log("get after step:", JSON.stringify(row));
    
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
