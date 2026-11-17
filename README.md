# Here Happened

**The history of any place on Earth, with a source for every line.**

Drop a pin anywhere (a city square, a farm road, the middle of the Pacific) and Here Happened tells you what happened there through time: deep past to recent, at the spot, nearby, in the town, the county and the region. Every line is a sentence quoted from a real source you can open. Nothing is generated or made up, and when little is on record for a spot, the app says so and widens the circle.

## How it works

```
pin (lat, lng)
  │
  ├─ 1. Where is this?   Google reverse geocoding (server-side, daily cap, free fallback)
  │                      → name, town, county, region, country, or "open water"
  ├─ 2. What's nearby?   Wikipedia geosearch, English + the local language (10 km)
  ├─ 3. What happened?   Wikipedia articles for the spot, town, county and region
  │                      + Wikidata items with dates (founded, opened, battles, wrecks…)
  │                      → dated sentences quoted verbatim, sorted into eras
  └─ 4. Stream it        NDJSON from /api/place: place → nearby → timeline → done
```

- **Engine:** `lib/history/` builds a `PlaceStory` (see `lib/contract.ts`). No language model. Text is quoted from Wikipedia exactly as written, with its link and language. Dates are parsed from the sentence itself.
- **API:** `GET /api/place?lat=..&lng=..` streams `PlaceEvent` lines; add `&format=json` for one JSON object.
- **Map:** MapLibre GL with free OpenFreeMap vector tiles (no key, no billing) and a custom style.
- **Share links:** every place has a stable URL, `/place/41.890,12.492` (coordinates snapped to about 110 m), rendered on the server with its own title, description and preview image.
- **On This Day:** Wikipedia's selected anniversaries for today, showing only events whose article has real coordinates. Tap one to fly there.
- **Store:** Neon Postgres (free plan): a cache per place, per-visitor rate limits and a daily cap on paid geocoding calls. See `docs/STORE.md`.

## Cost per lookup

- Cached place: $0.
- New place: one Google Geocoding call, inside Google's 10,000 free calls a month (list price $5 per 1,000 after that). The app caps it at 300 a day by default and then uses a free fallback.
- Wikipedia, Wikidata, OpenFreeMap: free (we send a descriptive User-Agent and cache results).

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env.local   # then fill in the values
```

```bash
npm run dev
```

Open http://localhost:3000. Environment variables (`.env.local`, never committed):

| Name | What | Needed |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google key, used **server-side only** for reverse geocoding (the old name is kept so the Vercel env doesn't need to change) | Recommended; without it the free fallback names places |
| `DATABASE_URL` | Neon Postgres connection string (from the Vercel Neon integration) | Optional locally; without it there's no cache and no limits |
| `VISITOR_SALT` | Random string used to hash visitor IPs for rate limiting | Optional locally |
| `DAILY_GEOCODE_CAP` | Paid geocoding calls allowed per day (default 300) | Optional |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for share links and the sitemap | Set in production |

Check the engine from the command line:

```bash
npx tsx --env-file=.env.local scripts/check-place.ts 39.7442,-83.8086
```

Create the database tables once:

```bash
npx tsx --env-file=.env.local scripts/migrate.ts
```

## Deploy

The Vercel project `here-happened` (team "Sven Pro Services") builds every pushed branch as a private preview. Production builds from the default branch `dev`, so **don't push to `dev` until Sven says go**. For a manual preview from the linked folder:

```bash
vercel deploy
```

## Docs

- `docs/REWORK-PLAN.md`: the November 2026 audit, the plan, and before and after.
- `docs/FACTCHECK.md`: hand checks of claims against their sources for the test places.
- `docs/DECISIONS-FOR-SVEN.md`: open decisions.
- `docs/STORE.md`: cache, limits and the spend cap.
