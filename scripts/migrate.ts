/**
 * Apply db/schema.sql to the Neon database in DATABASE_URL. Idempotent.
 * Run: npx tsx --env-file=.env.local scripts/migrate.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (use --env-file=.env.local).");
    process.exit(1);
  }
  const sql = neon(url);
  const raw = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  const statements = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sql.query(stmt);
    console.log("ok:", stmt.split("\n")[0].slice(0, 80));
  }
  const tables = await sql.query(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  console.log("tables:", tables.map((t) => (t as { table_name: string }).table_name).join(", "));
}

main().catch((err) => {
  console.error("migration failed:", err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "<db-url>") : err);
  process.exit(1);
});
