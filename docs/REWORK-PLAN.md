# Here Happened: rework plan (Nov 2026)

## Status (keep current)

- 2026-11-16 19:35 ET: done and committed: store (Neon `here-happened-db`, free plan, iad1), engine `wiki-v1` (16 self-tests pass), share pages, OG images, sitemap/robots, On This Day. The screen (`components/explorer`) is in its final pass. The engine fact-check is running (`docs/FACTCHECK.md`). Next: commit the screen, build, push (Vercel builds a private preview of the branch), walk it at desktop and phone width, then write `docs/READY-FOR-REVIEW.md`.
- 2026-11-16 19:20 ET: branch `rework-2026-11` created from `dev`. Audit done (below). Contract in `lib/contract.ts`. Four helpers are building in parallel: engine (`lib/history`, `app/api/place`), screen (`components/explorer`, `app/globals.css`, `app/layout.tsx`), store (`lib/store.ts`, Neon), share pages and On This Day (`app/place`, `app/sitemap.ts`, `app/robots.ts`, `lib/today.ts`, `components/today`). Next: integrate, build, deploy a private preview, walk it in a browser.
- Production untouched. Nothing merged to `dev` or `main`.

## 1. Audit of the app as it was (Nov 16, 2026)

### Two "live" URLs, and only one is Sven's

- `https://here-happened.vercel.app` (the URL in our notes) is **not served by Sven's Vercel team**. It runs deployment `dpl_3WuCbp9s9oFjwsb2bgUpjHxoKp6n`, which the team `sven-pro-services` cannot see. Same app (same title, manifest, icons), but an older build whose code is not in git (it shows an "Archaeology" category and a "Close" button the repo doesn't have, and no On This Day toggle). It most likely belongs to Sven's old personal Vercel account from before the project moved to the team. Its engine still works, so someone's key is still paying for it.
- Sven's team production is `https://here-happened-nu.vercel.app` (the `-nu` suffix means the plain name was already taken when the team deployed). It runs the code on `dev`.

### What a query costs and whether it works

- `dev` / `-nu` production: **every lookup fails**. Walked in the browser Nov 16: tapping Cedarville shows a red banner, "Minified React error #441…", after ~20 s. The Perplexity key in `.env.local` and in Vercel (same key) returns `401 insufficient_quota`: the account is out of credits. When it had credits, each tap was one Perplexity `sonar` call with `search_context_size: high` (about $0.012 request fee plus tokens, roughly 1.5 cents a tap; "In-depth research" a second call). No cache, no rate limit, no spend cap: anyone could script it.
- Google Maps key: valid, **unrestricted** (works server-side with no referrer for Geocoding and Static Maps) and shipped in the browser bundle. It also carries a trailing newline (`%0A` in the script URL).

### Using it like a curious person (old build at here-happened.vercel.app, desktop and 375 px phone)

| Test place | Point | What the app said | Truth (Google reverse geocode) | Verdict |
|---|---|---|---|---|
| Famous city centre: the Colosseum, Rome | 41.8902, 12.4922 | Colosseum, Rome; 5 facts AD 64 – 17th c. | Colosseum | Right place. Facts plausible; sources are 3 homepages (Britannica, colosseo.it, UNESCO), none tied to a claim. 5.5 s. |
| Small American town: Cedarville, Ohio | 39.7442, -83.8086 | "Springfield, Ohio, near the Mad River and Clark County Fairgrounds" | Cedarville, Greene County | **Wrong town** (Springfield is ~15 km north, another county). Facts about Springfield; "George W. Loomis" inventor looks invented; one source is about Jamestown, Ohio. |
| Rural farmland, Iowa | 42.5530, -94.9500 | "Rural Kossuth County, near Algona" | Sac County | **Wrong county, ~100 km off.** All five facts about the wrong county. |
| Local record not in English: Wolframs-Eschenbach, Bavaria | 49.2267, 10.7267 | "Unterasbach, near Spalt" | Wolframs-Eschenbach | **Wrong town** (Spalt is ~15 km east). Missed Wolfram von Eschenbach and the Teutonic Order entirely. Claims "Spalt survived as a tiny imperial city": false (Spalt belonged to the Prince-Bishopric of Eichstätt). |
| Open ocean, central Pacific | -5.0, -140.0 | "~1,100 km southeast of Mangareva, Gambier Islands" | Open water ~430 km north of the Marquesas | **Wrong**: Mangareva is ~2,000 km south. Cites "UNESCO: The Cultural Landscape of the Gambier Islands", which does not exist (the nearby UNESCO site is the Marquesas, listed 2024). |

### What delights

- The core idea: tap anywhere, get a story. It's a great hook, and the copy reads well.
- The ocean answer was honest that nothing is recorded at the exact point, and widened to the region.

### What's slow

- 5–8 s of spinner per tap with nothing on screen; "In-depth research" asks for 20–30 s more.

### What's wrong or invented

- The model guesses the place from raw coordinates, so it names the wrong town 3 times in 4. Everything after that is history of the wrong place.
- Sources are typed by the model inside its JSON (not Perplexity's real citations), mostly homepages, never linked to a specific claim. One source title was made up.
- Dates are loose ("13th–19th centuries") and categories are guesses ("Battle" for a surveying expedition).
- On This Day (on `dev`) asks the model to invent latitude and longitude for each event.
- A JSON parse failure silently shows "Could not fully load results" with no facts.

### What looks dated

- Dark Google basemap, zinc cards, amber pin, pill badges: the stock shadcn + Google Maps look of every early-2026 AI demo. Geist font, no typographic voice.
- No search box: you can't type "Cedarville", only pan and tap.
- Timeline is a thin horizontal strip of dots with overlapping labels (`wip/timeline-tweak` only nudges dots apart).

### What breaks

- Production on `dev`: every tap (no credits).
- No share link: the URL never changes, so nothing can be posted.
- `userScalable: false` blocks pinch-zoom of text on phones (accessibility).
- A service worker (Serwist) caches the app shell, so users can be stuck on old builds.

## 2. What great looks like

1. **Trust by construction.** The app never asks a model "what happened here". It looks the place up (reverse geocoding), then pulls real, dated material from sources the reader can open (Wikipedia in English and the local language, Wikidata), and shows sentences exactly as the source wrote them, each with its link. When the spot has little on record, it says so and widens the circle: spot → nearby → town → county → region.
2. **The place is the interface.** A map you want to play with (globe at world view, your own cartographic style), search by name, drop a pin anywhere, and the story streams in: place name first, then what's nearby, then the timeline through the eras from deep past to recent.
3. **Shareable.** Every place has a stable link (`/place/41.890,12.492`), a server-rendered page with a real title, description and preview image.
4. **Safe and cheap.** No paid AI call is needed for a story. Results are cached per place in Neon; uncached lookups are rate-limited per visitor; the only paid call (Google Geocoding) has a daily cap with a free fallback. No secret key reaches the browser.

## 3. Steps

1. Engine: reverse geocode → Wikipedia geosearch (en + local language) + Wikidata dated items → verbatim dated sentences → timeline by era, with honest coverage notes. Streams as NDJSON.
2. Screen: MapLibre GL with OpenFreeMap vector tiles (free, no key), custom style, globe, search, pin, streaming story panel (side panel on desktop, bottom sheet on phone), timeline by era, nearby list, loading/empty/error states.
3. Store: Neon (free plan) for the place cache, per-visitor rate limits and the daily geocoding cap.
4. Share: `/place/[coords]` pages, Open Graph image, sitemap, robots, metadata.
5. On This Day: rebuilt on Wikipedia's On This Day feed, showing only events whose article has real coordinates.
6. Verify: build, private preview, browser walk at desktop and phone width, fact-check notes, before/after.
