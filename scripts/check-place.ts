/**
 * Usage: npx tsx --env-file=.env.local scripts/check-place.ts 39.7442,-83.8086 [--json]
 * Prints timings per event, the place, coverage, nearby titles and the timeline.
 */
import { buildPlaceStory } from "../lib/history";
import { datedSentences, findDate } from "../lib/history/dates";

/** `check-place.ts --selftest`: date parsing on tricky strings. */
function selftest(): boolean {
  const cases: [string, string, number, string][] = [
    ["en", "At around 1300 to 1200 BCE, the Lapita culture arrived.", -1300, "c. 1300–1200 BCE"],
    ["en", "Settlement dates to c. 3000–1500 BCE in the valley.", -3000, "c. 3000–1500 BCE"],
    ["en", "Between 1,000 and 800 BC, the sedentary Adena culture emerged.", -1000, "1,000–800 BC"],
    ["en", "Nomadic people lived here as early as 13,000 BC.", -13000, "13,000 BC"],
    ["en", "Cedarville was originally known as Milford, and platted in 1816.", 1816, "1816"],
    ["en", "Construction began under Emperor Vespasian (r. 69–79 AD) in 72 and was completed in AD 80.", 80, "AD 80"],
    ["en", "The town grew quickly in the 1850s after the railroad.", 1850, "1850s"],
    ["en", "The county was established on March 24, 1803 and named for Nathanael Greene.", 1803, "March 24, 1803"],
    ["en", "Many peoples lived here until approximately the 13th century.", 1250, "13th century"],
    ["de", "Der Ort wurde 1235 erstmals urkundlich erwähnt.", 1235, "1235"],
    ["de", "Im 13. Jahrhundert entstand die Kirche.", 1250, "13. Jahrhundert"],
    ["de", "Funde belegen eine Besiedlung um 1300–1200 v. Chr. im Tal.", -1300, "c. 1300–1200 v. Chr."],
    ["fr", "La ville est fondée au XIIe siècle par les moines.", 1150, "XIIe siècle"],
  ];
  const earlyCases: [string, string, number, string][] = [
    ["en", "In 217, the Colosseum was badly damaged by a major fire.", 217, "217"],
    ["en", "Honorius banned the practice of gladiator fights in 399 and again in 404.", 399, "399"],
    ["en", "Gladiatorial fights are last mentioned around 435.", 435, "435"],
    ["en", "From its dedication in 360 until 1453 it served as a cathedral.", 360, "360"],
    ["en", "It was finished by his son, Titus, in 80, and dedicated again in 80 or 81 AD.", 80, "80"],
    ["en", "Animal hunts continued until at least 523 in the arena.", 523, "523"],
    ["en", "The villa housed more than 300 people in 1850.", 1850, "1850"],
    ["en", "The wall stood in 300 metres of woods, rebuilt in 1850.", 1850, "1850"],
    ["de", "Im Jahr 532 wurde die Kirche zerstört.", 532, "532"],
  ];
  let ok = true;
  for (const [lang, text, year, label] of earlyCases) {
    const d = findDate(text, lang, true);
    const pass = d?.year === year && d?.dateLabel === label;
    if (!pass) ok = false;
    console.log(`${pass ? "PASS" : "FAIL"} early ${lang} ${JSON.stringify(text)} → ${d ? `${d.year} "${d.dateLabel}"` : "null"}${pass ? "" : ` (want ${year} "${label}")`}`);
  }
  for (const [lang, text, year, label] of cases) {
    const d = findDate(text, lang);
    const pass = d?.year === year && d?.dateLabel === label;
    if (!pass) ok = false;
    console.log(`${pass ? "PASS" : "FAIL"} ${lang} ${JSON.stringify(text)} → ${d ? `${d.year} "${d.dateLabel}"` : "null"}${pass ? "" : ` (want ${year} "${label}")`}`);
  }
  const ana = datedSentences("The Fort Ancient, Monongahela and Whittlesey peoples lived in Ohio. All three disappeared in the 17th century.", "en");
  const anaPass = ana.length === 1 && ana[0].text.startsWith("The Fort Ancient");
  console.log(`${anaPass ? "PASS" : "FAIL"} anaphor joins previous sentence`);
  const triv = datedSentences("The cross country team qualified for the State Meet in 2018.", "en");
  console.log(`${triv.length === 0 ? "PASS" : "FAIL"} school sports trivia dropped`);
  const weak = findDate("The house was the birthplace of Whitelaw Reid, candidate in the 1892 presidential election.", "en");
  console.log(`${weak?.weak ? "PASS" : "FAIL"} noun-phrase year marked weak`);
  return ok && anaPass && triv.length === 0 && !!weak?.weak;
}

async function main() {
  if (process.argv.includes("--selftest")) process.exit(selftest() ? 0 : 1);
  const arg = process.argv[2];
  const asJson = process.argv.includes("--json");
  if (!arg) {
    console.error("usage: check-place.ts lat,lng [--json]");
    process.exit(1);
  }
  const [lat, lng] = arg.split(",").map(Number);
  const t0 = Date.now();
  const story = await buildPlaceStory(lat, lng, (e) => {
    const ms = Date.now() - t0;
    if (e.type === "place") console.log(`[${ms} ms] place: ${e.place.name} | ${e.place.context} | ${e.place.kind}${e.place.countryCode ? ` | ${e.place.countryCode}` : ""}`);
    else if (e.type === "nearby") console.log(`[${ms} ms] nearby: ${e.items.length} items`);
    else if (e.type === "timeline") console.log(`[${ms} ms] timeline: ${e.entries.length} entries, ${e.sources.length} sources`);
    else console.log(`[${ms} ms] ${e.type}: ${JSON.stringify(e)}`);
  });
  console.log(`total ${Date.now() - t0} ms`);
  if (asJson) {
    console.log(JSON.stringify(story, null, 2));
    return;
  }
  console.log(`\nPLACE ${story.place.name} — ${story.place.context}`);
  console.log(`hierarchy: ${story.place.hierarchy.map((h) => `${h.level}=${h.name}`).join(", ")}`);
  console.log(`COVERAGE ${story.coverage.level}: ${story.coverage.note}`);
  console.log(`\nNEARBY (${story.nearby.length})`);
  for (const n of story.nearby.slice(0, 15)) console.log(`  ${n.distanceKm} km  ${n.title}${n.dateLabel ? ` (${n.dateLabel})` : ""}`);
  console.log(`\nTIMELINE (${story.timeline.length})`);
  for (const e of story.timeline) console.log(`  ${e.dateLabel} | ${e.scope}:${e.placeName} | ${e.lang} | ${e.text}\n      ${e.source.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
