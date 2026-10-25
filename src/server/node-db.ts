import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * A minimal, D1-compatible database binding backed by SQLite on the local
 * filesystem.
 *
 * TripSync is written against Cloudflare's D1 API (`prepare → bind →
 * first/all/run`, plus `batch`). On a plain Node host such as Render there is
 * no Workers runtime, so this module implements exactly the subset of that API
 * the app and drizzle-orm/d1 actually use, over better-sqlite3. Because both
 * engines are SQLite, the schema, migrations and every query stay identical —
 * only the binding differs.
 *
 * Semantics kept faithful to D1:
 * - values are normalised to the types D1 accepts (no booleans, Dates or
 *   undefined reach the driver);
 * - `batch` runs inside a single transaction, like D1's batch;
 * - foreign keys and WAL are enabled (the schema's ON DELETE CASCADE rules
 *   must actually fire so account deletion cannot leave orphaned rows).
 */

type SqlValue = string | number | bigint | null | Uint8Array;

/** The value types D1 accepts, plus the harmless extras JS callers may pass. */
function normalize(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  // Anything else (objects, arrays) is a programming error; fail loudly and
  // identically to how D1 would reject it.
  throw new TypeError(
    `Unsupported bind parameter of type ${typeof value}. D1 only accepts strings, numbers, booleans, dates, buffers and null.`,
  );
}

function metaOf(info: { changes: number; lastInsertRowid: number | bigint }) {
  return {
    changes: info.changes,
    last_row_rowid: Number(info.lastInsertRowid),
    rows_read: 0,
    rows_written: info.changes,
    duration: 0,
  };
}

class NodePreparedStatement {
  private readonly params: unknown[];

  constructor(
    private readonly db: Database.Database,
    private readonly sql: string,
    params: unknown[] = [],
  ) {
    this.params = params;
  }

  bind(...params: unknown[]): NodePreparedStatement {
    return new NodePreparedStatement(this.db, this.sql, params);
  }

  private bound(): SqlValue[] {
    return this.params.map(normalize);
  }

  /** First row as an object, or null — same contract as D1's `first()`. */
  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.bound());
    return (row ?? null) as T | null;
  }

  /** All rows as objects inside a D1-style result envelope. */
  async all<T>(): Promise<{ results: T[]; success: true; meta: ReturnType<typeof metaOf> }> {
    const results = this.db.prepare(this.sql).all(...this.bound()) as T[];
    return { results, success: true, meta: metaOf({ changes: 0, lastInsertRowid: 0 }) };
  }

  /** Synchronous execution used by both `run()` and `batch()`. */
  runSync() {
    const info = this.db.prepare(this.sql).run(...this.bound());
    return {
      results: [] as never[],
      success: true as const,
      meta: metaOf({ changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) }),
    };
  }

  /** Executes a write and reports rows changed, like D1's `run()`. */
  async run(): Promise<ReturnType<NodePreparedStatement["runSync"]>> {
    return this.runSync();
  }

  /** Rows as arrays of column values — drizzle's `values()` path uses this. */
  async raw<T>(): Promise<T[]> {
    return this.db.prepare(this.sql).raw().all(...this.bound()) as T[];
  }
}

/**
 * Creates the binding. `databasePath` should point at a persistent disk in
 * production (e.g. `/data/tripsync.sqlite` on Render); the directory is
 * created on first use.
 */
export function createNodeD1(databasePath: string): D1Database {
  const resolved = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  // Match the hosted engine: WAL for concurrent readers, enforced foreign
  // keys so cascades behave exactly as they do on D1.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  const client = {
    prepare(sql: string) {
      return new NodePreparedStatement(db, sql);
    },
    // D1's batch is atomic; better-sqlite3 gives us the same guarantee with
    // a transaction around the whole list.
    async batch(statements: NodePreparedStatement[]) {
      return db.transaction((items: NodePreparedStatement[]) =>
        items.map((statement) => statement.runSync()),
      )(statements);
    },
    // Present so anything that introspects the binding (health checks, tooling)
    // sees a filesystem path like D1's database_name.
    get database_name() {
      return path.basename(resolved);
    },
    // Kept for API parity with D1: appends one or more statements. The app
    // never calls it today; migrations go through `batch`.
    exec(sql: string) {
      db.exec(sql);
      return Promise.resolve({ count: 0, duration: 0 });
    },
  };

  return client as unknown as D1Database;
}
