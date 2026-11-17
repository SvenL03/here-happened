# Ready for review: Here Happened rework

Written 2026-11-16, about 20:00 ET. Branch `rework-2026-11` (latest commit on GitHub). Production untouched.

## Preview (private)

- **Stable branch URL, always the newest build of this branch:** https://here-happened-git-rework-2026-11-sven-pro-services.vercel.app
- **Reviewer access link, valid until Tue Nov 17, 11:54 PM ET** (a temporary Vercel share link; it sets a cookie, then plain URLs on that host work):
  https://here-happened-git-rework-2026-11-sven-pro-services.vercel.app/?_vercel_share=f03E0SXRG0N2gGm1q4iGyfgN3DLOrvOs
- Without the link, the preview asks for a Vercel sign-in (Vercel Authentication on previews). Previews are `noindex`, and their robots.txt disallows everything.

## How to exercise it

1. Open the access link. You get a globe and "Tap anywhere on Earth…" with five suggestions.
2. Tap anywhere on the map. The pin drops, the URL becomes `/place/LAT,LNG`, the name streams in first, then nearby, then the timeline by era.
3. Search "Colosseum" in the box, pick a result, and the map flies there.
4. Read the coverage note (how close the record is), use the era bar to jump, open a source link, and press "Share this place".
5. Open "On this day" (top right) and pick an event; the map flies to it and loads that place.
6. At phone width (≤640 px) the story is a bottom sheet: tap or drag the handle.
7. Share pages and images: `/place/41.890,12.492`, `/place/41.890,12.492/opengraph-image`, `/opengraph-image`, `/sitemap.xml`, `/robots.txt`.
8. API: `/api/place?lat=..&lng=..` (NDJSON stream) or `&format=json`; `/api/today?m=11&d=16`.

## Test places

| # | Place | Link path | What to expect |
|---|---|---|---|
| 1 | Famous city centre: Colosseum, Rome | `/place/41.890,12.492` | "Colosseum", spot coverage, 24 entries from AD 70 |
| 2 | Small American town: Cedarville, Ohio | `/place/39.744,-83.809` | "Cedarville", Greene County; widens to town, county and Ohio |
| 3 | Rural farmland: Sac County, Iowa | `/place/42.553,-94.950` | "Sac County" (the old app said Kossuth County, ~100 km off) |
| 4 | Local record not in English: Wolframs-Eschenbach, Bavaria | `/place/49.227,10.727` | the church at the pin; German sentences with a language badge, plus English |
| 5 | Open ocean: central Pacific | `/place/-5.000,-140.000` | "Pacific Ocean", sea coverage built around the Marquesas, with the distance stated |
| 6 | Mine: Falls Park, Greenville SC | `/place/34.844,-82.401` | "Liberty Bridge at Falls Park on the Reedy" |
| 7 | Mine: Nan Madol, Pohnpei | `/place/6.844,158.336` | "Nan Madol", spot coverage |
| 8 | Bonus, empty desert: near Tindouf, Algeria | `/place/27.945,-4.368` | honest "little is recorded" note, widening to Tindouf Province and Algeria |

## What I verified

- **Build:** `next build --webpack` passes; `tsc` is clean; eslint shows 0 errors and 1 unused-variable warning in `lib/history/wiki.ts`. The Vercel preview build is Ready.
- **In a real browser (built-in pane) on the deployed preview:**
  - Desktop: the home globe, a real tap in the Sahara (URL updates, story streams), search "Colosseum" (fly and load), Rome's timeline with source links, and On This Day with an event flying to the Hoxne Hoard.
  - 390 px phone: Cedarville's peek sheet, then the expanded sheet. No horizontal scroll (scrollWidth 390).
  - Note: the pane was hidden, which pauses animation frames, so I forced frames with a timer to let the map draw (verification only, not in the app).
- **API on the preview, all 7 test places plus Tindouf:** 200; names correct; 1.7–4.2 s uncached with the 7 run in parallel; a cache hit in 0.14 s (`done.cached: true`).
- **SEO:** canonical, OG and Twitter tags present; the OG image renders. I looked at the PNG for Cedarville and fixed its date strip to prefer the town's own dates.
- **Server logs:** no error or warning runtime logs on the preview in the last 30 min. The app logs little, so this is weak evidence.
- **Fact-check:**
  - `docs/FACTCHECK.md`, by the engine helper: 33 of 33 sampled sentences across the 7 places were found on their source pages, with the shown year in the text and about the right place. Four engine bugs found there were fixed.
  - My own independent re-check, verbatim against the live pages:
    - Cedarville "platted in 1816"
    - Tindouf Province "rebuilt … in 1852 by members of the Tajakant tribe"
    - Schloss Wolframs-Eschenbach (de) "1332 erhielt der Orden das kaiserliche Privileg…"
    - Nan Madol "multi-beam sonar"
    - Hoxne Hoard
    All 5 found.
- **Store:** live smoke test 14/14 (`scripts/store-smoke.ts`): cache, the 21st lookup in 10 min is blocked, and the geocode cap.

## Fixed after this file was first written (20:00–20:07 ET)

- Web Interface Guidelines pass (a11y, contrast, keyboard pin drop, icons). Rankings trivia dropped. Region/country sentences must name the region/country. Spot coverage note reworded.

## What I know is still open

- **Year attribution:** a year in a sentence isn't always the year of the event. The sentence is shown verbatim, so the reader sees the context, but the date chip can mislead. Example: Hoxne shows "365 CE" on a sentence about Palaeolithic to Roman finds; check it.
- **Trivia leaks:** some still gets through (e.g. Sac County's "Best Places to Live in Rural America" 2007).
- **Grammar:** coverage notes read "the story of Colosseum" (no article).
- **Long or local names:** spot names are full Wikipedia titles and can be long ("Liberty Bridge at Falls Park on the Reedy"); some context names come out in the local language.
- **Ocean names:** they come from coarse lat/lng boxes, so a point near a sea boundary can get the neighbouring sea's name.
- **Not checked in a browser:**
  - the rate-limit message (checked in the DB test, not on screen)
  - the offline state
  - dark mode on the preview (the screen helper checked it locally)
  - real-device touch dragging of the sheet
- **Icons:** the favicon and app icons still have the old look.
- **Wikimedia load:** each new place makes about 10–14 requests to Wikimedia, at most 6 at a time.
