/**
 * Neon (serverless Postgres) over HTTP. Server-only.
 *
 * getDb() is a lazy singleton: null when DATABASE_URL is missing, so callers
 * degrade to no-ops. query() never throws: on a missing DB, an error or a
 * timeout it returns null, so a DB hiccup can't break a page.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let sql: Sql | null | undefined;

export function getDb(): Sql | null {
  if (sql !== undefined) return sql;
  if (typeof window !== "undefined") return (sql = null); // never in the browser
  const url = process.env.DATABASE_URL;
  try {
    sql = url ? neon(url) : null;
  } catch {
    sql = null;
  }
  return sql;
}

export const DB_TIMEOUT_MS = 2000;

/** Run one parameterised statement. Returns rows, or null when there is no DB, it errors or it times out. */
export async function query<R = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  timeoutMs: number = DB_TIMEOUT_MS,
): Promise<R[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db.query(text, params, { fetchOptions: { signal: AbortSignal.timeout(timeoutMs) } });
    return rows as R[];
  } catch (err) {
    if (process.env.NODE_ENV !== "production" || process.env.STORE_DEBUG) {
      console.warn("[store] query failed:", err instanceof Error ? err.name + ": " + err.message.replace(/postgres(ql)?:\/\/\S+/g, "<db-url>").slice(0, 160) : "unknown");
    }
    return null;
  }
}
