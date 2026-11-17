/** Small network helpers: polite Wikimedia fetches with a shared concurrency cap and per-fetch timeouts. */

export const UA = "HereHappened/2.0 (https://here-happened-nu.vercel.app; history map)";

const MAX_CONCURRENT = 6;
let active = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

/** GET JSON from a Wikimedia (or other free) API with the app's User-Agent. Throws on HTTP error or timeout. */
export async function getJson<T>(url: string, timeoutMs = 4000, extraHeaders: Record<string, string> = {}): Promise<T> {
  const tq = Date.now();
  await acquire();
  const ts = Date.now();
  try {
    if (process.env.HH_DEBUG) res_debug(url, "start", ts - tq);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json", ...extraHeaders },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    const j = (await res.json()) as T;
    if (process.env.HH_DEBUG) res_debug(url, "done", Date.now() - ts);
    return j;
  } finally {
    release();
  }
}

function res_debug(url: string, what: string, ms: number) {
  const u = new URL(url);
  const kind = u.searchParams.get("generator") ?? u.searchParams.get("action") ?? (u.searchParams.get("query") ? "sparql" : "");
  console.error(`  [net] ${what} ${u.host} ${kind} ${u.searchParams.get("titles") ?? ""} ${ms}ms`);
}

/** Resolve with the promise's value, or with `fallback` once `ms` pass. Never rejects. */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Lower-case, strip accents and punctuation: for loose name comparison only (never for display). */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ぀-ヿ一-鿿 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words of a place name minus generic admin words ("county", "landkreis", ...). */
export function nameTokens(s: string): string[] {
  const generic = new Set([
    "county", "district", "landkreis", "kreis", "province", "provincia", "region", "state", "of", "the", "city",
    "metropolitan", "citta", "metropolitana", "di", "de", "du", "la", "le", "municipality", "township", "parish",
    "borough", "department", "departement", "prefecture", "oblast", "regierungsbezirk", "capitale", "capital",
  ]);
  return norm(s)
    .split(" ")
    .filter((w) => w.length > 1 && !generic.has(w));
}

/** True if any meaningful token of `a` appears in `b` (or the reverse). */
export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const sb = new Set(tb);
  const sa = new Set(ta);
  return ta.some((w) => sb.has(w)) || tb.some((w) => sa.has(w));
}
