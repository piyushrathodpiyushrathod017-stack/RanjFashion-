import path from "node:path";

async function main() {
  try {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs({
      locateFile: (f) => path.join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.run("INSERT INTO t VALUES (?, ?)", [1, "hello"]);
    const stmt = db.prepare("SELECT * FROM t WHERE id = ?");
    console.log("stmt type:", typeof stmt, "bind:", typeof stmt.bind, "get:", typeof stmt.get);
    const bound = stmt.bind([1]);
    console.log("bound === stmt:", bound === stmt, "bound type:", typeof bound);
    const row = stmt.get();
    console.log("Result:", JSON.stringify(row));
    console.log("SUCCESS: sql.js works");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
