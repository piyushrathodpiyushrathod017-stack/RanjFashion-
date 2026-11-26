const initSqlJs = require("sql.js");

async function main() {
  try {
    const SQL = await initSqlJs({
      locateFile: (f) => require("path").join(process.cwd(), "node_modules", "sql.js", "dist", f),
    });
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.run("INSERT INTO t VALUES (?, ?)", [1, "hello"]);
    const row = db.prepare("SELECT * FROM t WHERE id = ?").bind([1]).get();
    console.log("Result:", JSON.stringify(row));
    console.log("SUCCESS: sql.js works");
  } catch (e) {
    console.error("FAILED:", e.message);
    console.error(e.stack);
  }
}

main();
