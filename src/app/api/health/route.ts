import { getBindings } from "@/server/db";
import { ensureMigrated, migrationStatus } from "@/server/migrations";

export const dynamic = "force-dynamic";

export async function GET() {
  // Works on both runtimes: the D1 binding on Cloudflare, the SQLite file
  // binding under plain Node (Render) — same API, same migration gate.
  const env = getBindings();
  const db = env.DB;
  if (!db) {
    return Response.json({ database: "missing" }, { status: 503 });
  }
  const row = await db.prepare("select 1 as ok").first<{ ok: number }>();
  if (row?.ok !== 1) {
    return Response.json({ database: "unexpected" }, { status: 503 });
  }
  // The health check is also the migration gate: a fresh database is migrated
  // here before any page or auth request can touch it.
  await ensureMigrated(db);
  const migrations = await migrationStatus(db);
  const tables = await db
    .prepare(
      `select count(*) as total from sqlite_master where type = 'table' and name not like 'sqlite_%'`,
    )
    .first<{ total: number }>();
  return Response.json({
    database: "ok",
    migrations,
    tables: tables?.total ?? 0,
  });
}
