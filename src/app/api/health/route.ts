import { getD1 } from "@/server/db";
import { ensureMigrated, migrationStatus } from "@/server/migrations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getD1();
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
        `select count(*) as total from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE'`,
      )
      .first<{ total: number }>();
    return Response.json({
      database: "ok",
      migrations,
      tables: Number(tables?.total ?? 0),
    });
  } catch (error) {
    // No connection string, wrong credentials or an unreachable database —
    // report honestly without echoing the connection details.
    const message = error instanceof Error ? error.message : "unavailable";
    return Response.json({ database: "error", message }, { status: 503 });
  }
}
