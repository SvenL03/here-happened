/**
 * Store: cache, rate limits and the daily spend cap (Neon Postgres, see docs/STORE.md).
 * Every function degrades gracefully: with no DATABASE_URL, an error or a timeout it
 * never throws and falls back to "no cache, allowed, under cap".
 */
import type { PlaceStory } from "@/lib/contract";
import { getDb, query } from "@/lib/db";

/** The engine whose cached stories we serve. A cached row from any other engine is a miss. */
const CURRENT_ENGINE = process.env.STORY_ENGINE || "wiki-v1";
const CACHE_DAYS = 30;

/** Uncached lookups allowed per visitor. */
const LIMIT_10_MIN = 20;
const LIMIT_24_H = 120;
const BUCKET_SEC = 600;

function dailyCap(kind: "geocode"): number {
  const raw = kind === "geocode" ? process.env.DAILY_GEOCODE_CAP : undefined;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 300;
}

function validKey(key: string): boolean {
  return typeof key === "string" && key.length > 0 && key.length <= 64;
}

export async function getCachedStory(key: string): Promise<PlaceStory | null> {
  if (!validKey(key)) return null;
  const rows = await query<{ engine: string; story: PlaceStory }>(
    `select engine, story from place_cache
      where key = $1 and created_at > now() - make_interval(days => $2::int)`,
    [key, CACHE_DAYS],
  );
  const row = rows?.[0];
  if (!row || !row.story || typeof row.story !== "object") return null;
  if (row.engine !== CURRENT_ENGINE || row.story.engine !== row.engine) return null;
  void query(`update place_cache set hits = hits + 1 where key = $1`, [key]); // fire-and-forget
  return row.story;
}

export async function putCachedStory(key: string, story: PlaceStory): Promise<void> {
  if (!validKey(key) || !story) return;
  const empty = (story.timeline?.length ?? 0) === 0 && (story.nearby?.length ?? 0) === 0;
  if (empty && story.coverage?.level !== "sea") return; // don't cache failures; empty open water is a real answer
  let json: string;
  try {
    json = JSON.stringify(story);
  } catch {
    return;
  }
  await query(
    `insert into place_cache (key, engine, story) values ($1, $2, $3::jsonb)
     on conflict (key) do update set engine = excluded.engine, story = excluded.story, created_at = now()`,
    [key, String(story.engine ?? ""), json],
  );
  if (Math.random() < 1 / 50) {
    void query(`delete from place_cache where created_at < now() - make_interval(days => $1::int)`, [CACHE_DAYS]);
  }
}

/** Per-visitor limit for uncached lookups. ipHash is a salted hash, never the raw IP. */
export async function checkRateLimit(ipHash: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  if (!ipHash || ipHash.length > 128) return { ok: true };
  // One atomic statement: read the rolling 24 h total, then increment this 10-minute
  // bucket only while both limits allow it. No row back from `up` means blocked.
  const rows = await query<{ cur: number | null; day: number; bucket_left: number; day_left: number | null }>(
    `with day as (
       select coalesce(sum(count), 0)::int as n, min(bucket) as oldest
         from rate_hits where visitor = $1::text and bucket > now() - interval '24 hours'
     ), up as (
       insert into rate_hits (visitor, bucket, count)
       select $1::text, to_timestamp(floor(extract(epoch from now()) / ${BUCKET_SEC}) * ${BUCKET_SEC}), 1
        where (select n from day) < $3::int
       on conflict (visitor, bucket) do update set count = rate_hits.count + 1
        where rate_hits.count < $2::int
       returning count
     )
     select (select count from up) as cur,
            (select n from day) as day,
            ceil(${BUCKET_SEC} - mod(extract(epoch from now())::numeric, ${BUCKET_SEC}))::int as bucket_left,
            ceil(extract(epoch from ((select oldest from day) + interval '24 hours' - now())))::int as day_left`,
    [ipHash, LIMIT_10_MIN, LIMIT_24_H],
  );
  if (Math.random() < 1 / 50) {
    void query(`delete from rate_hits where bucket < now() - interval '2 days'`);
  }
  const row = rows?.[0];
  if (!row || row.cur !== null) return { ok: true };
  const overDay = row.day >= LIMIT_24_H;
  const wait = overDay ? (row.day_left ?? BUCKET_SEC) : row.bucket_left;
  return { ok: false, retryAfterSec: Math.max(1, Math.min(86_400, Number(wait) || BUCKET_SEC)) };
}

/** Paid calls only (today: Google Geocoding). units = number of calls. */
export async function recordSpend(kind: "geocode", units: number): Promise<void> {
  const n = Math.floor(Number(units));
  if (!Number.isFinite(n) || n <= 0) return;
  await query(
    `insert into spend_daily (day, kind, units) values ((now() at time zone 'utc')::date, $1, $2)
     on conflict (day, kind) do update set units = spend_daily.units + excluded.units`,
    [kind, n],
  );
}

/** False once today's paid calls pass the cap; the engine then uses its free fallback. */
export async function underDailyCap(kind: "geocode"): Promise<boolean> {
  const cap = dailyCap(kind);
  if (cap === 0) return false;
  const rows = await query<{ units: number }>(
    `select units from spend_daily where day = (now() at time zone 'utc')::date and kind = $1`,
    [kind],
  );
  if (!rows) return !getDb(); // no DB configured: permissive; DB error/timeout: fail closed (free fallback)
  return (rows[0]?.units ?? 0) < cap;
}

export async function hashVisitor(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${process.env.VISITOR_SALT ?? "here-happened"}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
