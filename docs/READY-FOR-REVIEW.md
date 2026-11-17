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

- **Year attribution:** a year in a sentence isn't always the year of the event. The sentence is shown verbatim, so the reader sees the context, but the date chip can mislead. Sentences whose only year sits inside a noun phrase rank lower. Hoxne's "365 CE" turned out to be right: the joined sentence says "coins from about 365 CE".
- **Trivia:** the obvious kinds (sports results, rankings) are filtered, but some can still get through.
- **Long or local names:** spot names are full Wikipedia titles and can be long ("Liberty Bridge at Falls Park on the Reedy"); some context names come out in the local language.
- **Ocean names:** they come from coarse lat/lng boxes, so a point near a sea boundary can get the neighbouring sea's name.
- **Not checked in a browser:**
  - the rate-limit message (checked in the DB test, not on screen)
  - the offline state
  - dark mode on the preview (the screen helper checked it locally)
  - real-device touch dragging of the sheet
- **Wikimedia load:** each new place makes about 10–14 requests to Wikimedia, at most 6 at a time.

## Review round 1: what I did with the 12 confirmed findings (20:35 ET)

Source: the coordinator's independent review (partial: the "years and eras" lens never ran). Fixes are in the engine, so the cache was cleared and the preview rebuilds on push.

| # | Finding | Result |
|---|---|---|
| 1 (high) | Years 1–999 without AD/CE never parsed | **Fixed.** `earlyYears()` in `lib/history/dates.ts`: a bare 1–3 digit year after a dating word (in, around, until, since, from…; German, French, Italian, Spanish, Portuguese equivalents), only in an article that already uses AD/CE, never before a unit or a count noun ("in 300 people"). One or two digits count only before a comma or full stop. 9 new self-tests (25 checks total), including the review's sentences. Colosseum now shows 217 (fire), 399/404 (ban), 435 (last games), 523 and the 1349 earthquake; Hagia Sophia shows 339, 360, 405 and AD 537. To let them through, the selector now penalises years within 8 of one already picked (70, 72, 79, 80 were one event). |
| 2 | Cedarville University dropped (Education section skipped); one house supplies a quarter of the story | **Fixed.** Education and notable-people sections are mined for town and spot articles, keeping only sentences that name the place ("Cedarville University… since 1887" is in). Nearby sources are capped at 2 entries each. |
| 3 | Within an article, order of appearance decides; Colosseum fills slots with etymology | **Fixed.** Etymology and naming sections now come after the history sections, and "In popular culture", "Legacy" and similar sections are skipped. |
| 4 | Colosseum "1942" is about a look-alike building | **Fixed** by skipping "In popular culture". I did not add a rule that the spot's name must be the sentence's subject: too blunt for the many true sentences that open with a pronoun or a person. |
| 5 | "The name received official recognition… in 1838" with no context | **Fixed.** Sentences opening with a bare definite noun (the name, the passage, the structure…) join the previous sentence or are dropped. |
| 6 | German sentence cut at "rd." | **Fixed.** Abbreviations added (rd, inkl, max, min, zw, ca, etwa); "Einwohner" sections count as statistics. |
| 7 | The 9 kB German church article is thrown away for a 2-sentence English stub | **Fixed.** When the local-language article is more than twice as long (and over 4 kB), it is mined too. The church now has its 1430/40 tower, the 1713–1719 baroque redesign and the 1749 chapel, in German. |
| 8 | Unresolved references shown alone (English-only, sentence-initial only) | **Mostly fixed.** The join rule now also covers German, French, Italian and Spanish pronouns, object pronouns ("claim them"), "followed", bare definite subjects, and drops "will be…" sentences about dates already past. Not exhaustive: other languages and mid-sentence references remain. |
| 9 | Coverage note promises a town story that isn't there | **Fixed.** The note names a wider place only if an entry in the final timeline comes from it. |
| 10 | Header "250 BCE to 2007" is a computed midpoint | **Fixed.** The span uses the first and last entries' own date labels, from the spot, nearby and town when there are at least three. |
| 11 | Region entries about other parts of the region | **Partly fixed.** Sentences that name a sub-area ("northern Ohio") or open "In <Town>, <Upper Region>" are dropped. A sentence about a distant part that avoids those patterns can still get through. |
| 12 | Source links open the top of the article | **Fixed.** Links carry a text fragment (`#:~:text=` plus the sentence's first seven words), so supporting browsers scroll to and highlight the sentence; others open the article as before. |
| plausible | Date chip isn't the event's year in about 6% of entries | **Not fixed.** The sentence stays verbatim, so the reader sees the context. A "which / until" weak-year rule would help; it is the next thing I'd do. |

I disagree with nothing in the confirmed list; items 4, 8 and 11 are the ones where I went only part of the way, for the reasons above.

My own pass on the years-and-eras lens (the reviewers never ran it): BCE ranges, decades, "13,000 BC", German centuries and `v. Chr.`, parenthesised reigns and unit counts are covered by the 25 self-tests, and all pass. Japanese dates (紀元前, 約300年前) are not handled: the parser reads 紀元前300年 as AD 300. That is open; no Japanese test place surfaced it.
