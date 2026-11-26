import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

type SqlJsDatabase = {
  prepare(sql: string): SqlJsStatement;
  exec(sql: string): void;
  export(): Uint8Array;
  close(): void;
};

type SqlJsStatement = {
  bind(values: unknown[]): boolean;
  step(): boolean;
  get(): unknown[];
  getAsObject(): Record<string, unknown>;
  run(): void;
  finalize(): void;
  free(): void;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "dev.sqlite");

let dbPromise: Promise<SqlJsDatabase> | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (!dbPromise) {
    dbPromise = loadDb();
  }
  return dbPromise;
}

async function loadDb(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let buffer: Uint8Array | undefined;
  try {
    buffer = fs.readFileSync(DB_PATH);
  } catch {
    // No existing database yet; start fresh.
  }

  return new SQL.Database(buffer) as unknown as SqlJsDatabase;
}

export function persistDb(db: SqlJsDatabase): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, db.export());
}

export function queryAll(
  db: SqlJsDatabase,
  sql: string,
  values: unknown[] = []
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(values);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, unknown>);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne(
  db: SqlJsDatabase,
  sql: string,
  values: unknown[] = []
): Record<string, unknown> | null {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(values);
    if (stmt.step()) {
      return stmt.getAsObject() as Record<string, unknown>;
    }
    return null;
  } finally {
    stmt.free();
  }
}

export function run(
  db: SqlJsDatabase,
  sql: string,
  values: unknown[] = []
): void {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(values);
    stmt.run();
  } finally {
    stmt.free();
  }
}
