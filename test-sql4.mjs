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
    
    const stmt = db.prepare("SELECT * FROM t");
    console.log("Statement methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(stmt)));
    console.log("bind:", typeof stmt.bind);
    console.log("get:", typeof stmt.get);
    console.log("run:", typeof stmt.run);
    console.log("columns:", typeof stmt.columns);
    
    const cols = stmt.columns();
    console.log("columns:", JSON.stringify(cols));
    
    const bindResult = stmt.bind([]);
    console.log("bind result:", bindResult);
    const row = stmt.get();
    console.log("get:", JSON.stringify(row));
    
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
