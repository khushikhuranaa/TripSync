import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";
import * as schema from "./schema";

/**
 * Access to the database — Supabase Postgres through one shared `pg` pool.
 *
 * Two surfaces over the same pool:
 *
 * - **`getDb()`** — a Drizzle instance. Better Auth's drizzle adapter uses it;
 *   the schema's custom timestamp type maps bigint epoch-ms columns to `Date`
 *   so the library always sees what it expects.
 * - **`getD1()`** — a small D1-shaped facade (`prepare` → `bind` →
 *   `run` / `all` / `first`, plus `batch`). The app's parameterised SQL keeps
 *   working byte-for-byte: `?` placeholders are translated to Postgres
 *   `$1..$n` on the way out, and results arrive with the same shape the code
 *   already destructures.
 *
 * Configuration (`DATABASE_URL`, auth secret, AI provider, email) is read from
 * the Cloudflare-shaped env when `next dev` provides it (OpenNext loads
 * `.dev.vars` there), otherwise from `process.env` — which is how Render
 * serves the site.
 */

type Env = CloudflareEnv;

export function getBindings(): Env {
  let workerEnv: Record<string, unknown> | undefined;
  try {
    workerEnv = getCloudflareContext().env as unknown as
      | Record<string, unknown>
      | undefined;
  } catch {
    // Plain Node (`next start` on Render): no Workers context — process.env it is.
  }
  const merged: Record<string, unknown> = { ...process.env };
  for (const [key, value] of Object.entries(workerEnv ?? {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as unknown as Env;
}

// Postgres returns bigint (OID 20) as a string by default. Every bigint column
// in this schema holds epoch milliseconds or a small count — exactly what the
// SQLite version returned as numbers — so parse it as a number once, globally.
types.setTypeParser(20, (value) => Number(value));

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getBindings().DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Point it at the Supabase Postgres connection string (Connection pooling → Transaction, port 6543) — see README.md.",
      );
    }
    // Supabase requires TLS on the pooler endpoint. `require` is the mode the
    // dashboard hands out; verify-ca/verify-full keep full certificate checks.
    const sslMode = connectionString.match(/sslmode=([^&]+)/i)?.[1]?.toLowerCase();
    const useSsl = Boolean(sslMode) && sslMode !== "disable";
    pool = new Pool({
      connectionString,
      max: 8,
      ...(useSsl
        ? {
            ssl: {
              rejectUnauthorized:
                sslMode === "verify-ca" || sslMode === "verify-full",
            },
          }
        : {}),
    });
    // A pooled client can fail asynchronously (network blip). Without a
    // listener that error would take the whole process down.
    pool.on("error", (error) => {
      console.error("Postgres pool error:", error.message);
    });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// D1-shaped facade over the pool
// ---------------------------------------------------------------------------

/** What the app reads off a write: `written.meta.changes` guards two optimistic locks. */
export type SqlRunResult = {
  success: boolean;
  meta: { changes: number; last_row_id: number };
};

export interface SqlStatement {
  bind(...params: unknown[]): SqlStatement;
  run(): Promise<SqlRunResult>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta: { changes: number };
  }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface SqlDb {
  prepare(sql: string): SqlStatement;
  /** Atomic multi-statement write (the D1 `batch` contract the app relies on). */
  batch(statements: SqlStatement[]): Promise<SqlRunResult[]>;
}

/**
 * Rewrites `?` placeholders to Postgres `$1..$n`, skipping anything inside
 * single- or double-quoted strings (the app's SQL binds every value; quotes
 * only ever carry literals like `'INR'` or `''`).
 */
function toPositional(sql: string): string {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let out = "";
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (!inSingle && !inDouble && char === "-" && next === "-") {
      // A line comment: copy it verbatim, placeholders or not.
      const newline = sql.indexOf("\n", i);
      const end = newline === -1 ? sql.length : newline;
      out += sql.slice(i, end);
      i = end - 1;
      continue;
    }
    if (!inSingle && !inDouble && char === "/" && next === "*") {
      const close = sql.indexOf("*/", i + 2);
      const end = close === -1 ? sql.length : close + 2;
      out += sql.slice(i, end);
      i = end - 1;
      continue;
    }
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === "?" && !inSingle && !inDouble) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += char;
  }
  return out;
}

class PgStatement implements SqlStatement {
  constructor(
    private readonly pool: Pool,
    private readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): SqlStatement {
    return new PgStatement(this.pool, this.sql, params);
  }

  /** `batch` runs bound statements on one client, so it needs both pieces. */
  positional(): string {
    return toPositional(this.sql);
  }

  async run(): Promise<SqlRunResult> {
    const result = await this.pool.query(this.positional(), this.params);
    return {
      success: true,
      meta: { changes: result.rowCount ?? 0, last_row_id: 0 },
    };
  }

  async all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta: { changes: number };
  }> {
    const result = await this.pool.query(this.positional(), this.params);
    return {
      results: result.rows as T[],
      success: true,
      meta: { changes: result.rowCount ?? 0 },
    };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.pool.query(this.positional(), this.params);
    return (result.rows[0] as T | undefined) ?? null;
  }
}

class PgDb implements SqlDb {
  prepare(sql: string): SqlStatement {
    return new PgStatement(getPool(), sql);
  }

  async batch(statements: SqlStatement[]): Promise<SqlRunResult[]> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const results: SqlRunResult[] = [];
      for (const statement of statements) {
        const pgStatement = statement as PgStatement;
        const result = await client.query(
          pgStatement.positional(),
          pgStatement.params,
        );
        results.push({
          success: true,
          meta: { changes: result.rowCount ?? 0, last_row_id: 0 },
        });
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

let db: SqlDb | null = null;

/** The raw-SQL handle every server module queries through. */
export function getD1(): SqlDb {
  return (db ??= new PgDb());
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Database = ReturnType<typeof getDb>;

export { schema };
