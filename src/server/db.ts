import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createNodeD1 } from "./node-db";

/**
 * Access to the database.
 *
 * Two runtimes, one API:
 *
 * - **Cloudflare (Workers / `next dev`)** — `next.config.ts` loads the same
 *   binding Wrangler uses, so the code path is identical locally and on the
 *   deployed Worker: a real D1 binding named `DB`.
 * - **Plain Node (Render and friends)** — there is no Workers context, so the
 *   binding falls back to a SQLite file implementing the same D1 API
 *   (`src/server/node-db.ts`). The file lives at `DATABASE_PATH` (point it at
 *   a persistent disk, e.g. `/data/tripsync.sqlite`); everything else —
 *   schema, migrations, queries — is unchanged because both engines are
 *   SQLite.
 *
 * Non-database configuration (auth secret, AI provider, email) is read from
 * the Cloudflare env when present, otherwise from `process.env`.
 */

type Env = CloudflareEnv;

let nodeEnv: Env | null = null;

function nodeEnvBindings(): Env {
  if (!nodeEnv) {
    const databasePath =
      process.env.DATABASE_PATH ?? `${process.cwd()}/data/tripsync.sqlite`;
    nodeEnv = {
      DB: createNodeD1(databasePath),
      ...process.env,
    } as unknown as Env;
  }
  return nodeEnv;
}

export function getBindings(): Env {
  try {
    const { env } = getCloudflareContext();
    if (env?.DB) return env as Env;
  } catch {
    // No Cloudflare context — running under plain Node (e.g. `next start`
    // on Render). Fall through to the file-backed binding.
  }
  return nodeEnvBindings();
}

export function getD1(): D1Database {
  const { DB } = getBindings();
  if (!DB) {
    throw new Error(
      "The database binding named DB is missing. Set DATABASE_PATH (or the D1 binding) and check README.md.",
    );
  }
  return DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export type Database = ReturnType<typeof getDb>;

export { schema };
