import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read `.dev.vars` itself; load it when DATABASE_URL is
// not already in the environment, so `drizzle-kit generate/push` work locally
// the same way `next dev` does.
if (!process.env.DATABASE_URL && existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !line.trim().startsWith("#")) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
});
