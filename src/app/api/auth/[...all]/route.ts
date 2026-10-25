import { getAuth } from "@/server/auth";
import { getBindings } from "@/server/db";
import { ensureMigrated } from "@/server/migrations";

export const dynamic = "force-dynamic";

// Sign-up touches the user/account tables before any session exists, so the
// auth handler must not race the schema on a fresh database.
async function handle(request: Request) {
  await ensureMigrated(getBindings().DB);
  return getAuth().handler(request);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
