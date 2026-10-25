import { migrations } from "./migration-sql";
import type { SqlDb } from "./db";

/**
 * Server-side schema migrations, applied at runtime against Postgres.
 *
 * The routine runs inside the app (health check, auth, first server query)
 * rather than as a deploy step, and it is:
 *
 * - **Ledgered:** applied migration ids are recorded in `schema_migrations`,
 *   so each migration runs at most once per database.
 * - **Repeat-safe:** statements are normalised to `IF NOT EXISTS`, and the
 *   error class a re-run can still produce ("already exists") is tolerated.
 *   This matters for a local database that has the full schema but no ledger:
 *   its first run back-fills the ledger without failing.
 * - **Cached per handle:** a WeakSet keyed on the database handle means the
 *   ledger is read once per process, not on every request.
 *
 * Ordering follows `drizzle/meta/_journal.json`.
 */

const LEDGER_TABLE = `create table if not exists schema_migrations (
  id text primary key,
  applied_at bigint not null
)`;

const ran = new WeakSet<SqlDb>();
const inFlight = new WeakMap<SqlDb, Promise<void>>();

/** Matches errors that only a harmless re-run of an already-applied statement produces. */
function isAlreadyApplied(message: string) {
  return (
    message.includes("already exists") ||
    message.includes("duplicate column") ||
    message.includes("duplicate name")
  );
}

/**
 * Drizzle files use plain CREATE; Postgres also accepts the IF NOT EXISTS form.
 * The match is anchored on the keyword rather than the start of the string,
 * because a statement can begin with the file's leading comments.
 */
function makeIdempotent(statement: string) {
  return statement
    .replace(/\bCREATE UNIQUE INDEX\b/i, "CREATE UNIQUE INDEX IF NOT EXISTS")
    .replace(/\bCREATE INDEX\b/i, "CREATE INDEX IF NOT EXISTS")
    .replace(/\bCREATE TABLE\b/i, "CREATE TABLE IF NOT EXISTS");
}

async function migrateOnce(db: SqlDb): Promise<void> {
  await db.prepare(LEDGER_TABLE).run();

  const { results } = await db
    .prepare(`select id from schema_migrations`)
    .all<{ id: string }>();
  const applied = new Set((results ?? []).map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const [index, statement] of statements.entries()) {
      try {
        await db.prepare(makeIdempotent(statement)).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isAlreadyApplied(message)) continue;
        // Surface exactly which migration and statement failed; never the SQL
        // body (it may contain data) and never anything secret.
        throw new Error(
          `Migration ${migration.id} failed at statement ${index + 1} of ${statements.length}: ${message}`,
        );
      }
    }

    await db
      .prepare(`insert into schema_migrations (id, applied_at) values (?, ?)`)
      .bind(migration.id, Date.now())
      .run();
  }
}

/**
 * Applies any pending migrations through `db`, once per process per handle.
 * Safe to call from any request path; concurrent callers share one run.
 */
export function ensureMigrated(db: SqlDb): Promise<void> {
  if (ran.has(db)) return Promise.resolve();
  let pending = inFlight.get(db);
  if (!pending) {
    pending = migrateOnce(db)
      .then(() => {
        ran.add(db);
      })
      .finally(() => {
        inFlight.delete(db);
      });
    inFlight.set(db, pending);
  }
  return pending;
}

/** How many migrations the ledger has recorded (for health reporting). */
export async function migrationStatus(db: SqlDb) {
  try {
    const row = await db
      .prepare(`select count(*) as total from schema_migrations`)
      .first<{ total: number }>();
    return { applied: Number(row?.total ?? 0), expected: migrations.length };
  } catch {
    // The ledger table does not exist yet: nothing has been applied.
    return { applied: 0, expected: migrations.length };
  }
}
