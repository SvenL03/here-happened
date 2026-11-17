# Fact-check: grounded-history engine (wiki-v1)

Run 2026-11-16, 19:15–19:45 ET, against live Wikipedia, Wikidata and Google Geocoding, using `scripts/check-place.ts`.

## Method

1. Run `npx tsx --env-file=.env.local scripts/check-place.ts LAT,LNG --json` for each place.
2. Compare the place name and context with Google's reverse geocode for the same point.
3. For each place, sample 4–5 timeline entries (first, a third of the way in, two thirds, last, plus one from a different scope). For each sample:
   - fetch the source URL (the real `en.`/`de.wikipedia.org/wiki/...` page, HTML);
   - strip tags and citation `<sup>`s;
   - check that the sentence is on the page, either exactly or with at least 80% of its 6-word windows matching (the plain-text extract and the HTML differ slightly around IPA and quotes);
   - check that the date label shown appears in the sentence and that the parsed year matches it;
   - judge by hand whether the entry is about the right place and whether the year dates the event.
4. Fix the engine for anything that fails, then re-run.

The checker script lives in the session scratchpad and isn't part of the repo. Run `npx tsx scripts/check-place.ts --selftest` for the date parser's unit checks: 16 checks, all passing. They cover BCE ranges, `13,000 BC`, reign spans in parentheses, decades, full dates, German centuries, `v. Chr.` ranges and French Roman-numeral centuries, plus the anaphor, trivia and weak-year rules.

## Summary

| Place (point) | Google geocode says | Engine name / context | Named right? | Times: place / nearby / timeline | Entries | Coverage | Sampled claims |
|---|---|---|---|---|---|---|---|
| Colosseum, Rome (41.8902,12.4922) | tourist_attraction (no name); premise "Colosseo"; locality Roma | Colosseum / Rome, Metropolitan City of Rome Capital, Lazio, Italy | Pass | 0.59 / 0.89 / 1.33 s | 24 | spot | 4/4 pass |
| Cedarville, Ohio (39.7442,-83.8086) | locality Cedarville, Greene County, Ohio | Cedarville / Greene County, Ohio, United States | Pass | 0.50 / 0.69 / 1.22 s | 17 | nearby | 5/5 pass |
| Rural Sac County, Iowa (42.5530,-94.9500) | containment: Sac County, Iowa (the plus-code result says Buena Vista County and Newell, which is wrong; we ignore it) | Sac County / Iowa, United States | Pass (old app's wrong-county bug is gone) | 0.47 / 0.65 / 1.15–2.17 s | 15–16 | county | 5/5 pass (1 fixed after this run, see below) |
| Wolframs-Eschenbach, Bavaria (49.227,10.727; also 49.2267,10.7267) | premise and street results; locality Wolframs-Eschenbach, Landkreis Ansbach, Bayern | Liebfrauenmünster, Wolframs-Eschenbach (the church article at the pin) / Wolframs-Eschenbach, Ansbach, Bavaria, Germany | Pass (no longer a bus stop or hair salon) | 0.59 / 0.90 / 1.50 s | 24 (German and English) | spot | 4/5 pass, 1 fixed |
| Open Pacific (-5.0,-140.0) | ZERO_RESULTS | Pacific Ocean / Open water | Pass | 0.41 / 0.70 / 0.99 s | 18 | sea | 4/4 pass |
| Falls Park, Greenville SC (34.8442,-82.4013) | transit_station "Falls Park"; locality Greenville | Liberty Bridge at Falls Park on the Reedy / Greenville, Greenville County, South Carolina, United States | Pass (Wikipedia article at the pin) | 0.54 / 0.70 / 2.40 s | 24 | spot | 5/5 pass |
| Nan Madol, Pohnpei (6.844,158.336; also 6.8442,158.3358) | tourist_attraction (no name); admin2 Madolenihmw; admin1 Pohnpei | Nan Madol / Madolenihmw, Pohnpei, Micronesia | Pass (was "Micronesia", then "Madolenihmw") | 0.51–1.13 / 0.6–1.5 / 1.1–2.0 s | 20 | spot | 5/5 pass |

Every run finished in under 2.5 s. The place event arrives in 0.4–0.6 s when Google is warm; a cold Google TLS handshake has reached 1.1–1.4 s.

## Hand-checked claims

`PASS` means the sentence is on the source page, the year matches the text, and the entry is about the right place.

**Colosseum**
- PASS: "...after the First Jewish–Roman War in 70 AD..." (70 AD). https://en.wikipedia.org/wiki/Colosseum
- PASS: "...in about 1533 referred to..." (1533). 4 of 5 windows match; the extract renders the Middle English quote slightly differently from the HTML. https://en.wikipedia.org/wiki/Colosseum
- PASS: "The Summer Olympic Games medal from 1928 to 2000..." (1928). https://en.wikipedia.org/wiki/Colosseum
- PASS: "The passage will be opened to the public on 27 October 2025." (27 October 2025). https://en.wikipedia.org/wiki/Colosseum

**Cedarville**
- PASS: "...inhabited by nomadic people as early as 13,000 BC." (year -13000; it was "000 BC" before the fix). https://en.wikipedia.org/wiki/Ohio
- PASS: "There were three other cultures ... All three disappeared in the 17th century." The anaphor is now joined with the previous sentence; both sentences are verbatim and consecutive. https://en.wikipedia.org/wiki/Ohio
- PASS: "For many years beginning in the 1880s, public life in Cedarville centered around the downtown Cedarville Opera House..." https://en.wikipedia.org/wiki/Cedarville,_Ohio
- PASS: "Cedarville was settled by Irish and Scottish immigrants in 1799." https://en.wikipedia.org/wiki/Cedarville,_Ohio
- PASS: "In 2002, Governor Bob Taft launched the "Third Frontier" program..." (region scope). https://en.wikipedia.org/wiki/Ohio

**Sac County**
- PASS: "On January 13, 1846, the legislative body of the Iowa Territory authorized creation of twelve counties..." https://en.wikipedia.org/wiki/Sac_County,_Iowa
- PASS: "The new courthouse ... was placed in service in January 1874..." https://en.wikipedia.org/wiki/Sac_County,_Iowa
- PASS: "During the Late Prehistoric period (beginning about AD 900)..." https://en.wikipedia.org/wiki/Iowa
- FAIL, then fixed: the first run used the article https://en.wikipedia.org/wiki/Sac_County_Courthouse as the county. Its sentences were real, but it was the wrong article: Wikidata matched "Sac County Courthouse" before "Sac County". Admin resolution now prefers exact name matches. It now uses https://en.wikipedia.org/wiki/Sac_County,_Iowa.
- WEAK: "In 2009, the magazine ranked Sac County as the tenth "Best Place"..." The source and year are right, but it's trivia without context. The engine now joins "the magazine" sentences with their previous sentence; the current run shows the February 2007 Progressive Farmer sentence instead, which is verbatim but still trivia.
- FAIL, then fixed: "...an exception was ultimately granted and 1200 Tai Dam were resettled in Iowa." The engine had read 1200 as a year; it's a head count. The parser now rejects "NNNN Name were/was/...".

**Wolframs-Eschenbach** (German and English sources)
- PASS: "Seit 1859 befindet sich die Stadtverwaltung im ehemaligen Schloss." (de, 1859). https://de.wikipedia.org/wiki/Schloss_Wolframs-Eschenbach
- PASS: "Schläfenringe datieren einige Bestattungen noch in das 8. Jahrhundert." (8. Jahrhundert, year 750). https://de.wikipedia.org/wiki/Schloss_Wolframs-Eschenbach
- PASS: "Since 2007, Wolframs-Eschenbach has been a state-approved resort." https://en.wikipedia.org/wiki/Wolframs-Eschenbach
- PASS: "In 1806, Eschenbach became part of the Kingdom of Bavaria." https://en.wikipedia.org/wiki/Wolframs-Eschenbach
- FAIL, then fixed: "...Wappen des Hochmeisters Erzherzog Karl von Österreich (1618–24) angebracht." The sentence is real, but 1618 is a term of office, not the date of the relief. Dates whose only occurrence is a bare span in parentheses are now dropped.
- Context added: "Evidence suggests up to 500 people lived in the village from 450 BC." On its own, the village is unclear. It is now joined with the previous sentence, which names the Celtic settlement north of Munich (region scope Bavaria). https://en.wikipedia.org/wiki/Bavaria

**Open Pacific**
- PASS: "The first Europeans to reach the Marquesas may have been ... June 1526..." https://en.wikipedia.org/wiki/Marquesas_Islands
- PASS: "In 1813, Commodore David Porter claimed Nuku Hiva for the United States..." https://en.wikipedia.org/wiki/Marquesas_Islands
- PASS: "The reserve was declared in 1992..." https://en.wikipedia.org/wiki/Eiao_Island_Nature_Reserve
- PASS: "...estimated to have taken place already in 15000 BCE." This comes from the ocean-wide article, now capped at 4 entries and ranked after the Marquesas. https://en.wikipedia.org/wiki/Pacific_Ocean
- FAIL, then fixed: "In 2024 ... under "Te Henua Enata" (lit." The sentence was cut at the abbreviation "lit.". "lit." is now an abbreviation, and sentences with unbalanced parentheses are dropped.
- Fixed: the earlier "nearby" list was solar eclipses. Eclipse, astronomical and abstract items are now excluded, and Wikidata items without a Wikipedia article are dropped. Coverage note: "Open ocean. Nothing is recorded at this point; here is what's on record in this part of the Pacific Ocean, around Marquesas Islands (the nearest, Motu One, is 321 km away)." The distance is computed from Wikidata coordinates.

**Falls Park**
- PASS: "...a wall from the original 1776 grist mill built on the site." https://en.wikipedia.org/wiki/Falls_Park_on_the_Reedy
- PASS: "In October 2014, about a decade after the bridge's opening, mayor Knox H. White said..." https://en.wikipedia.org/wiki/Liberty_Bridge_at_Falls_Park_on_the_Reedy
- PASS: "A wealthy settler from Virginia named Richard Pearis arrived in South Carolina around 1754..." (town scope). https://en.wikipedia.org/wiki/Greenville,_South_Carolina
- PASS: "Old Greenville City Hall ... built as the U.S. Courthouse and Post Office in 1889..." (nearby). https://en.wikipedia.org/wiki/Old_Greenville_City_Hall
- FAIL, then fixed: "Greenville was established in 1797..." was labelled county scope "Greenville County" but came from the city article, because a loose token match between "Greenville" and "Greenville County" picked the city. Ancestors now require an exact label first, and the town's own name is excluded.

**Nan Madol**
- PASS: "The earliest settlement on Pohnpei was probably around AD 1..." https://en.wikipedia.org/wiki/Nan_Madol
- PASS: "Nan Madol was the capital of the Saudeleur dynasty until about 1628." https://en.wikipedia.org/wiki/Nan_Madol
- PASS: "In 2013, Ishimura and others used multi-beam sonar..." https://en.wikipedia.org/wiki/Nan_Madol
- PASS: "The Caroline Islands ... were visited on 22 August 1526..." (region scope Pohnpei). https://en.wikipedia.org/wiki/Pohnpei_State
- PASS: "Japanese sovereignty lasted from 1914 to 1945." https://en.wikipedia.org/wiki/Pohnpei_State

## Earlier integrator findings (Cedarville), now fixed

- Anaphors such as "All three", "These", "It" or "He": the sentence is joined with the previous one from the same paragraph if the pair stays under 420 characters; otherwise it's dropped.
- School sports and other trivia (team, season, championship, qualifying, playoffs, varsity, tournament, "won the ... title") are dropped.
- A year that only qualifies a noun ("the 1892 presidential election") and adjectival "19th-century" are marked weak and ranked lower.
- BCE ranges keep their era: "1300 to 1200 BCE" gives year -1300 and label "c. 1300–1200 BCE"; "c. 3000–1500 BCE" gives -3000.
- Statistics are dropped: percentages, "As of ...", student counts, census and population lines.
- Names never come from transit, route, street, premise or plus-code results. The spot is a Wikipedia article within 200 m (300 m with no locality; up to 600 m for big sites with no locality, such as Nan Madol). Otherwise the name is the locality, then the county.

## Cost of one uncached lookup

- Google Geocoding: 1 call, $0.005 at list price. With no key, or over `underDailyCap("geocode")`, the engine falls back to OSM Nominatim, which is free; it sends the app's User-Agent and never invents a name.
- Wikimedia: about 10–14 free requests. That's 1–2 geosearches, 2–4 Wikidata entity searches, 2 SPARQL queries (or 3 for water: dated items plus islands), and 3–7 article extracts, with at most 6 at a time.

## Known gaps

- Ocean names come from coarse boxes. Points near a boundary can get the neighbouring sea's name, and Antarctica's interior (ZERO_RESULTS) would be called "Southern Ocean".
- The timeline is English-first. A local-language entry is dropped when English has the same year at the same scope, which is a crude same-fact test.
- Spot names are Wikipedia titles, so some are long ("Liberty Bridge at Falls Park on the Reedy", "Liebfrauenmünster, Wolframs-Eschenbach").
- Place names partly stay in the local language when Google's English name doesn't share a prefix (for example "Bayern" alone; "Bavaria" comes through when the plus-code result agrees).
- Some trivia still gets through (magazine rankings), and so do title years such as "A Narrative of 1757 (published in 1826)".
- AD ranges ("70–72 AD") take the second number as the label.
