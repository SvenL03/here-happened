# Store: cache, rate limits, spend cap

Code: `lib/store.ts` (API), `lib/db.ts` (Neon HTTP client), `db/schema.sql` (tables).

Database: Neon Postgres `here-happened-db`, free plan, created through the Vercel Marketplace
(region iad1 / AWS us-east-1), connected to the `here-happened` project for Production and Preview.

## What's stored

| Table | What | Kept |
|---|---|---|
| `place_cache` | Finished place stories (JSON) keyed by `placeKey(lat, lng)`, plus the engine that built them and a hit count | Served for 30 days. Expired rows are pruned now and then (1 in 50 writes) |
| `rate_hits` | Uncached lookups per visitor per 10-minute bucket. The visitor is a salted SHA-256 of the IP (`hashVisitor`, salt `VISITOR_SALT`), never the raw IP | Buckets older than 2 days are pruned (1 in 50 calls) |
| `spend_daily` | Paid API calls per UTC day (today only `geocode`) | Kept (one tiny row a day) |

## Rules and why

- **Cache.** A story is served from cache when it is younger than 30 days and was built by the current
  engine (`wiki-v1`, override with `STORY_ENGINE`). Any other engine is a miss, so a new engine rebuilds
  stories instead of serving old ones. **When the engine string changes, update `CURRENT_ENGINE` in
  `lib/store.ts` (or set `STORY_ENGINE`), or the cache will miss on every lookup.**
  Failures aren't cached: a story with no timeline and no nearby entries is skipped, unless its coverage
  is `sea` (empty open water is a real answer).
- **Rate limit.** 20 uncached lookups per 10 minutes and 120 per rolling 24 hours per visitor. Cached
  lookups are free. Blocked calls return `retryAfterSec`. This stops one visitor (or a script) from
  burning the shared Wikipedia/Wikidata goodwill and the geocoding budget.
- **Spend cap.** 300 Google Geocoding calls per UTC day by default. Google gives 10,000 free Geocoding
  calls a month; 300 a day stays inside that. Over the cap, the engine uses its free fallback.
- **Never breaks a page.** Nothing throws. With no `DATABASE_URL` (local dev) every function falls back
  to: no cache, allowed, under the cap. On a DB error or timeout (2 s) it's the same, except the spend
  cap fails closed (the engine uses its free fallback), so an outage can't lift the paid-call cap.
  Set `STORE_DEBUG=1` to log failures in production.

## Change the limits

| Env var | Default | Effect |
|---|---|---|
| `DAILY_GEOCODE_CAP` | 300 | Paid geocoding calls per UTC day. `0` turns paid geocoding off |
| `STORY_ENGINE` | `wiki-v1` | Engine whose cached stories are served |
| `VISITOR_SALT` | (secret) | Salt for visitor hashes. Changing it resets everyone's rate limit |

The 20 / 120 per-visitor limits and the 30-day cache age are constants at the top of `lib/store.ts`.
Set env vars in Vercel (Project, Settings, Environment Variables) and redeploy.

## Setup and migration

- Vercel holds `DATABASE_URL` (plus the other `POSTGRES_*` / `PG*` vars the integration added) and
  `VISITOR_SALT` for Production and Preview. Never prefix them with `NEXT_PUBLIC_`.
- Local: `DATABASE_URL` and `VISITOR_SALT` are in `.env.local` (gitignored). A private copy of the Neon
  vars is in `~/.config/here-happened/neon.env` (mode 600). To refresh:
  `vercel env pull <tmpfile> --environment=preview --yes`, copy what you need, delete the tmp file.
- Apply the schema (idempotent, safe to rerun):
  `npx tsx --env-file=.env.local scripts/migrate.ts`
- Smoke test (writes fake rows, then deletes them):
  `npx tsx --env-file=.env.local scripts/store-smoke.ts`, and the no-database path:
  `env -u DATABASE_URL npx tsx scripts/store-smoke.ts --no-db`

## Cost

Free. The database is on Neon's free plan through the Vercel Marketplace; for the current storage and
compute allowances, see the Neon free plan on neon.com/pricing (not copied here because they change).
Most of the data is cached stories; the 30-day prune keeps that bounded. If the database ever becomes
unreachable, the app keeps working without the cache, and paid geocoding stops until it's back.
