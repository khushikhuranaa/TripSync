import { migrations } from "./migration-sql";

/**
 * Server-side schema migrations.
 *
 * Freebuff Sites has no SQL console, so the hosted D1 database is migrated by
 * this routine running inside the Worker against the `DB` binding. It is:
 *
 * - **Ledgered:** applied migration ids are recorded in `schema_migrations`,
 *   so each migration runs at most once per database.
 * - **Repeat-safe:** statements are normalised to `IF NOT EXISTS`, and the two
 *   error classes a re-run can still produce ("already exists", "duplicate
 *   column") are tolerated. This matters for the local database, which has the
 *   full schema but no ledger: its first run back-fills the ledger without
 *   failing.
 * - **Cached per isolate:** a WeakSet keyed on the binding object means the
 *   ledger is read once per isolate, not on every request.
 *
 * Ordering follows `drizzle/meta/_journal.json`: 0000 → 0001 → 0002 → 0003.
 */

const LEDGER_TABLE = `create table if not exists schema_migrations (
  id text primary key,
  applied_at integer not null
)`;

const ran = new WeakSet<D1Database>();
const inFlight = new WeakMap<D1Database, Promise<void>>();

/** Matches errors that only a harmless re-run of an already-applied statement produces. */
function isAlreadyApplied(message: string) {
  return (
    message.includes("already exists") ||
    message.includes("duplicate column") ||
    message.includes("duplicate name")
  );
}

/** Drizzle files use plain CREATE; SQLite also accepts the IF NOT EXISTS form. */
function makeIdempotent(statement: string) {
  return statement
    .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
    .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
}

async function migrateOnce(db: D1Database): Promise<void> {
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
 * Applies any pending migrations through `db`, once per isolate per binding.
 * Safe to call from any request path; concurrent callers share one run.
 */
export function ensureMigrated(db: D1Database): Promise<void> {
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
export async function migrationStatus(db: D1Database) {
  try {
    const row = await db
      .prepare(`select count(*) as total from schema_migrations`)
      .first<{ total: number }>();
    return { applied: row?.total ?? 0, expected: migrations.length };
  } catch {
    // The ledger table does not exist yet: nothing has been applied.
    return { applied: 0, expected: migrations.length };
  }
}
