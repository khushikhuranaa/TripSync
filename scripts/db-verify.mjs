/**
 * Verifies the Postgres schema without a database server or credentials.
 *
 * PGlite is Postgres compiled to WebAssembly: it applies `drizzle/0000_init.sql`
 * exactly like Supabase would, then re-runs it to prove the runner's
 * "already exists" tolerance, then exercises the real statement shapes the app
 * uses (bigint timestamps, boolean toggles, the vote upsert, the quoted `"user"`
 * table and a rolled-back transaction).
 *
 * Run with `npm run db:verify`.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const sqlFile = readFileSync(new URL("../drizzle/0000_init.sql", import.meta.url), "utf8");

/** Same algorithm as `toPositional()` in src/server/db.ts. */
function toPositional(sql) {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let out = "";
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (!inSingle && !inDouble && char === "-" && next === "-") {
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

/** Same algorithm as `makeIdempotent()` in src/server/migrations.ts. */
function makeIdempotent(statement) {
  return statement
    .replace(/\bCREATE UNIQUE INDEX\b/i, "CREATE UNIQUE INDEX IF NOT EXISTS")
    .replace(/\bCREATE INDEX\b/i, "CREATE INDEX IF NOT EXISTS")
    .replace(/\bCREATE TABLE\b/i, "CREATE TABLE IF NOT EXISTS");
}

const failures = [];
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const statements = sqlFile
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const db = new PGlite();
for (const statement of statements) await db.query(makeIdempotent(statement));
console.log(`1. applied ${statements.length} statements on a fresh Postgres`);

for (const statement of statements) await db.query(makeIdempotent(statement));
console.log("2. re-run is idempotent (IF NOT EXISTS)");

let rawError = "";
try {
  await db.query('CREATE TABLE "trips" (id text)');
} catch (error) {
  rawError = error.message;
}
check("duplicate-relation error matches isAlreadyApplied()", /already exists/.test(rawError));

const tables = await db.query(
  `select count(*)::int as total from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'`,
);
check("table count", tables.rows[0].total === 21, `${tables.rows[0].total} tables`);

const columns = await db.query(
  `select table_name, column_name, data_type from information_schema.columns
   where table_schema = 'public'
     and column_name in ('created_at','email_verified','packed','verified','onboarding_completed_at','applied_at')`,
);
const typeOf = (table, column) =>
  columns.rows.find((row) => row.table_name === table && row.column_name === column)?.data_type;
check("timestamps are bigint", typeOf("user", "created_at") === "bigint");
check("nullable timestamp is bigint", typeOf("user", "onboarding_completed_at") === "bigint");
check("email_verified is boolean", typeOf("user", "email_verified") === "boolean");
check("packed is boolean", typeOf("packing_items", "packed") === "boolean");
check("two_factor.verified is boolean", typeOf("two_factor", "verified") === "boolean");

const q = (text, params = []) => db.query(toPositional(text), params);
const now = Date.now();

await q(
  `insert into "user" (id, name, email, email_verified, role, home_city, travel_style, dietary_notes, notification_prefs, two_factor_enabled, created_at, updated_at)
   values (?, ?, ?, ?, 'user', '', 'Balanced', '', '', false, ?, ?)`,
  ["u1", "Asha", "asha@example.com", false, now, now],
);
await q(
  `insert into trips (id, owner_id, name, destination, region, description, start_date, end_date, traveller_count, budget_minor, currency, cover_image, cover_alt, created_at, updated_at)
   values (?, ?, ?, ?, '', '', ?, ?, ?, ?, 'INR', ?, ?, ?, ?)`,
  ["t1", "u1", "Goa", "Goa", "2026-12-01", "2026-12-05", 3, 500000, "", "", now, now],
);
await q(
  `insert into trip_members (id, trip_id, user_id, role, joined_at) values (?, ?, ?, 'owner', ?)`,
  ["m1", "t1", "u1", now],
);
await q(
  `insert into packing_items (id, trip_id, name, category, notes, quantity, assigned_to, packed, sort_order, created_by, created_at)
   values (?, ?, ?, ?, ?, ?, ?, false, 0, ?, ?)`,
  ["p1", "t1", "Sunscreen", "Essentials", null, 1, null, "u1", now],
);
const packing = await db.query("select packed, created_at from packing_items where id = $1", ["p1"]);
check("insert/read round-trip", packing.rows[0].packed === false && typeof packing.rows[0].created_at === "number");

await q(`update packing_items set packed = not packed where id = ? and trip_id = ?`, ["p1", "t1"]);
const toggled = await db.query("select packed from packing_items where id = $1", ["p1"]);
check("boolean toggle (`set packed = not packed`)", toggled.rows[0].packed === true);

await q(
  `insert into polls (id, trip_id, question, description, created_by, closes_at, status, created_at)
   values (?, ?, ?, '', ?, null, 'open', ?)`,
  ["po1", "t1", "Where?", "u1", now],
);
await q(`insert into poll_options (id, poll_id, label, sort_order) values (?, ?, ?, 0)`, ["o1", "po1", "Beach"]);
await q(`insert into poll_options (id, poll_id, label, sort_order) values (?, ?, ?, 1)`, ["o2", "po1", "Fort"]);
const voteSql = `insert into poll_votes (id, poll_id, option_id, user_id, created_at)
 select ?, ?, ?, ?, ?
 where exists (
   select 1 from polls
   where id = ? and status = 'open' and (closes_at is null or closes_at >= ?)
 )
 on conflict(poll_id, user_id) do update set
   option_id = excluded.option_id, created_at = excluded.created_at`;
await q(voteSql, ["v1", "po1", "o1", "u1", now, "po1", now]);
await q(voteSql, ["v2", "po1", "o2", "u1", now, "po1", now]);
const finalVote = await db.query("select option_id from poll_votes where poll_id = 'po1' and user_id = 'u1'");
check("vote insert + on-conflict upsert", finalVote.rows[0].option_id === "o2");

const lowered = await q(`select id from "user" where lower(email) = ?`, ["asha@example.com"]);
check('quoted "user" table + lower(email)', lowered.rows.length === 1);

const translated = toPositional(`insert into t (a) values ('100% ? ok') -- ? ?`);
check(
  "placeholder translation skips quoted strings and comments",
  translated === `insert into t (a) values ('100% ? ok') -- ? ?`,
);

await db.exec("BEGIN");
await q(
  `insert into trip_invitations (id, trip_id, inviter_id, invitee_email, invitee_name, invitee_user_id, role, token, status, created_at, expires_at, responded_at)
   values (?, ?, ?, ?, '', null, 'editor', ?, 'pending', ?, ?, null)`,
  ["i1", "t1", "u1", "bob@example.com", "tok1", now, now + 86400000],
);
await db.exec("ROLLBACK");
const invitations = await db.query("select count(*)::int as total from trip_invitations");
check("batch transaction rollback leaves no rows", invitations.rows[0].total === 0);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll database checks passed.");
