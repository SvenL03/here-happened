/**
 * Smoke test for lib/store.ts against the real database, then cleanup.
 *   npx tsx --env-file=.env.local scripts/store-smoke.ts           (real DB)
 *   env -u DATABASE_URL npx tsx scripts/store-smoke.ts --no-db     (no-op path)
 */
import type { PlaceStory } from "@/lib/contract";
import { query } from "@/lib/db";
import {
  checkRateLimit,
  getCachedStory,
  hashVisitor,
  putCachedStory,
  recordSpend,
  underDailyCap,
} from "@/lib/store";

let failed = 0;
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
}

function fakeStory(engine: string, withEntry: boolean, level: PlaceStory["coverage"]["level"] = "town"): PlaceStory {
  const source = { id: "smoke:src", title: "Smoke", url: "https://example.org/smoke", publisher: "Test", lang: "en" };
  return {
    place: { key: "0.000,0.000", lat: 0, lng: 0, name: "Smoke", context: "", kind: "land", hierarchy: [] },
    nearby: [],
    timeline: withEntry
      ? [{ id: "e1", year: 1900, dateLabel: "1900", era: "20c", text: "Smoke test.", lang: "en", scope: "town", placeName: "Smoke", source }]
      : [],
    coverage: { level, note: "smoke" },
    sources: withEntry ? [source] : [],
    generatedAt: new Date().toISOString(),
    engine,
  };
}

async function noDb() {
  check("no DB: get is null", (await getCachedStory("smoke:a")) === null);
  await putCachedStory("smoke:a", fakeStory("wiki-v1", true));
  check("no DB: put does not throw", true);
  const rl = await checkRateLimit("smoke-visitor");
  check("no DB: rate limit allows", rl.ok === true);
  await recordSpend("geocode", 1);
  check("no DB: recordSpend does not throw", true);
  check("no DB: under cap", (await underDailyCap("geocode")) === true);
  check("hashVisitor still works", (await hashVisitor("1.2.3.4")).length === 24);
}

async function realDb() {
  const tag = Math.random().toString(36).slice(2, 8);
  const keyOk = `smoke:${tag}:ok`;
  const keyStub = `smoke:${tag}:stub`;
  const keyEmpty = `smoke:${tag}:empty`;
  const keySea = `smoke:${tag}:sea`;
  const visitor = `smoke-${tag}`;
  try {
    // cache
    await putCachedStory(keyOk, fakeStory("wiki-v1", true));
    const got = await getCachedStory(keyOk);
    check("cache: put then get", got?.timeline[0]?.text === "Smoke test.");
    await putCachedStory(keyStub, fakeStory("stub", true));
    check("cache: other engine is a miss", (await getCachedStory(keyStub)) === null);
    await putCachedStory(keyEmpty, fakeStory("wiki-v1", false, "town"));
    const emptyRows = await query(`select 1 from place_cache where key = $1`, [keyEmpty]);
    check("cache: empty land story not stored", emptyRows?.length === 0);
    await putCachedStory(keySea, fakeStory("wiki-v1", false, "sea"));
    check("cache: empty sea story stored and served", (await getCachedStory(keySea)) !== null);
    await query(`update place_cache set created_at = now() - interval '31 days' where key = $1`, [keyOk]);
    check("cache: 31-day-old row is a miss", (await getCachedStory(keyOk)) === null);

    // rate limit: 20 allowed, 21st blocked
    const results = [];
    for (let i = 0; i < 21; i++) results.push(await checkRateLimit(visitor));
    const allowed = results.filter((r) => r.ok).length;
    const last = results[20];
    check("rate: first 20 allowed", results.slice(0, 20).every((r) => r.ok), `${allowed} allowed`);
    check("rate: 21st blocked", last.ok === false && (last.retryAfterSec ?? 0) > 0, `retryAfterSec=${last.retryAfterSec}`);
    // 24 h limit: pretend 120 hits earlier today in an older bucket
    await query(`delete from rate_hits where visitor = $1`, [visitor]);
    await query(`insert into rate_hits (visitor, bucket, count) values ($1, now() - interval '3 hours', 120)`, [visitor]);
    const dayBlocked = await checkRateLimit(visitor);
    check("rate: 24 h limit blocks", dayBlocked.ok === false, `retryAfterSec=${dayBlocked.retryAfterSec}`);

    // spend + cap
    const before = (await query<{ units: number }>(
      `select units from spend_daily where day = (now() at time zone 'utc')::date and kind = 'geocode'`,
    ))?.[0]?.units ?? 0;
    await recordSpend("geocode", 3);
    const after = (await query<{ units: number }>(
      `select units from spend_daily where day = (now() at time zone 'utc')::date and kind = 'geocode'`,
    ))?.[0]?.units ?? 0;
    check("spend: recorded", after === before + 3, `${before} -> ${after}`);
    process.env.DAILY_GEOCODE_CAP = String(after);
    check("cap: at cap is not under", (await underDailyCap("geocode")) === false);
    process.env.DAILY_GEOCODE_CAP = String(after + 1);
    check("cap: below cap is under", (await underDailyCap("geocode")) === true);
    delete process.env.DAILY_GEOCODE_CAP;
    check("cap: default 300", (await underDailyCap("geocode")) === after < 300);
  } finally {
    await query(`delete from place_cache where key like $1`, [`smoke:${tag}:%`]);
    await query(`delete from rate_hits where visitor = $1`, [visitor]);
    await query(
      `update spend_daily set units = greatest(0, units - 3) where day = (now() at time zone 'utc')::date and kind = 'geocode'`,
    );
    await query(`delete from spend_daily where units = 0`);
    const left = await query<{ n: number }>(
      `select (select count(*) from place_cache where key like $1)::int + (select count(*) from rate_hits where visitor = $2)::int as n`,
      [`smoke:${tag}:%`, visitor],
    );
    check("cleanup: no smoke rows left", left?.[0]?.n === 0);
  }
}

(process.argv.includes("--no-db") ? noDb() : realDb()).then(() => {
  console.log(failed ? `${failed} failed` : "all passed");
  process.exit(failed ? 1 : 0);
});
