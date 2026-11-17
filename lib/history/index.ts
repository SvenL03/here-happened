/**
 * The grounded-history engine. No LLM, nothing invented: every timeline entry is a sentence
 * copied from a Wikipedia page we fetched (only trimmed, citation markers removed), with its URL.
 * When little is recorded at the spot, the circle widens: spot → nearby → town → county → region → country (or sea).
 */
import type { Coverage, NearbyItem, PlaceEvent, PlaceStory, Scope, Source, TimelineEntry } from "@/lib/contract";
import { eraForYear } from "@/lib/contract";
import { datedSentences, firstSentence, pickText } from "./dates";
import { namesMatch, norm, round1, within } from "./net";
import { resolvePlace, toPlaceInfo } from "./place";
import type { AdminArticle, AdminChain, DatedItem, GeoPage } from "./wiki";
import { datedItemsAround, fullText, geosearch, intros, islandsAround, resolveAdmin, wikidataSource, wikiSource } from "./wiki";

export const ENGINE = "wiki-v1";

const LANG_BY_COUNTRY: Record<string, string> = {
  de: "de", at: "de", ch: "de", li: "de", lu: "fr", fr: "fr", be: "fr", mc: "fr", es: "es", mx: "es", ar: "es",
  co: "es", cl: "es", pe: "es", ve: "es", ec: "es", gt: "es", cu: "es", bo: "es", do: "es", hn: "es", py: "es",
  sv: "es", ni: "es", cr: "es", pa: "es", uy: "es", it: "it", sm: "it", va: "it", jp: "ja", pl: "pl", nl: "nl",
  pt: "pt", br: "pt", ao: "pt", mz: "pt", ru: "ru", by: "ru", cn: "zh", tw: "zh", hk: "zh", se: "sv", no: "no",
  dk: "da", fi: "fi", cz: "cs", sk: "sk", hu: "hu", ro: "ro", gr: "el", cy: "el", tr: "tr", kr: "ko", ua: "uk",
  il: "he", eg: "ar", sa: "ar", ma: "ar", dz: "ar", iq: "ar", sy: "ar", jo: "ar", lb: "ar", ae: "ar", tn: "ar",
  ir: "fa", id: "id", vn: "vi", th: "th", hr: "hr", rs: "sr", bg: "bg", ee: "et", lv: "lv", lt: "lt", si: "sl",
};

export function localLang(countryCode?: string): string {
  return (countryCode && LANG_BY_COUNTRY[countryCode]) || "en";
}

const SCOPE_RANK: Record<Scope, number> = { spot: 0, nearby: 1, town: 2, county: 3, sea: 3, region: 4, country: 5 };
const MAX_ENTRIES = 24;
/** Wider scopes may fill gaps, never take over the story. */
const SCOPE_CAP: Partial<Record<Scope, number>> = { region: 7, country: 5, county: 10, nearby: 10 };

interface Candidate {
  text: string;
  year: number;
  dateLabel: string;
  lang: string;
  scope: Scope;
  placeName: string;
  distanceKm?: number;
  source: Source;
  order: number;
  weak: boolean;
  /** Max entries from this candidate's source (the ocean-wide article only fills gaps). */
  sourceCap?: number;
  /** Extra rank cost (e.g. the ocean-wide article ranks after the nearest island group). */
  rankAdj: number;
}

function mine(
  text: string,
  lang: string,
  scope: Scope,
  placeName: string,
  source: Source,
  distance: number | undefined,
  orderBase: number,
  rankAdj = 0,
): Candidate[] {
  return datedSentences(text, lang).map((d, i) => ({
    ...d,
    rankAdj,
    lang,
    scope,
    placeName,
    distanceKm: distance === undefined ? undefined : round1(distance),
    source,
    order: orderBase + i,
  }));
}

function select(cands: Candidate[]): Candidate[] {
  // Dedupe identical sentences; drop a local-language sentence when English has the same year at the same or closer scope.
  const seen = new Set<string>();
  const enYears = new Map<number, number>();
  for (const c of cands) if (c.lang === "en") enYears.set(c.year, Math.min(enYears.get(c.year) ?? 9, SCOPE_RANK[c.scope]));
  const pool = cands.filter((c) => {
    const k = norm(c.text).slice(0, 140);
    if (seen.has(k)) return false;
    seen.add(k);
    if (c.lang !== "en" && (enYears.get(c.year) ?? 9) <= SCOPE_RANK[c.scope]) return false;
    return true;
  }).filter((c, _i, arr) => !arr.some((d) => d !== c && d.text.length < c.text.length && c.text.includes(d.text)));
  // Greedy: prefer closer scopes, but spread across eras.
  const picked: Candidate[] = [];
  const perEra = new Map<string, number>();
  const perYear = new Map<number, number>();
  const perScope = new Map<Scope, number>();
  const perSource = new Map<string, number>();
  const left = [...pool];
  while (picked.length < MAX_ENTRIES && left.length) {
    let bi = 0;
    let best = Infinity;
    for (let i = 0; i < left.length; i++) {
      const c = left[i];
      const era = eraForYear(c.year);
      const scopeCount = perScope.get(c.scope) ?? 0;
      if (scopeCount >= (SCOPE_CAP[c.scope] ?? MAX_ENTRIES)) continue;
      if (c.sourceCap !== undefined && (perSource.get(c.source.id) ?? 0) >= c.sourceCap) continue;
      const cost =
        1.5 * SCOPE_RANK[c.scope] + c.rankAdj + (c.weak ? 2 : 0) + 0.7 * (perEra.get(era) ?? 0) + 1.5 * (perYear.get(c.year) ?? 0) + c.order * 0.0001;
      if (cost < best) {
        best = cost;
        bi = i;
      }
    }
    if (best === Infinity) break;
    const c = left.splice(bi, 1)[0];
    picked.push(c);
    perScope.set(c.scope, (perScope.get(c.scope) ?? 0) + 1);
    perSource.set(c.source.id, (perSource.get(c.source.id) ?? 0) + 1);
    const era = eraForYear(c.year);
    perEra.set(era, (perEra.get(era) ?? 0) + 1);
    perYear.set(c.year, (perYear.get(c.year) ?? 0) + 1);
  }
  return picked.sort((a, b) => a.year - b.year || SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope]);
}

function pickAncestor(chain: AdminChain, names: (string | undefined)[]): AdminArticle | undefined {
  const ns = names.filter(Boolean) as string[];
  if (!ns.length) return undefined;
  const usable = chain.ancestors.filter((a) => (a.enTitle || a.localTitle) && a.qid !== chain.start?.qid);
  const labels = (a: AdminArticle) => a.label.split(" / ");
  // Exact label first ("Greenville County"), then a token match that is not just the town's own name.
  return (
    usable.find((a) => labels(a).some((l) => ns.some((n) => norm(l) === norm(n)))) ??
    usable.find(
      (a) =>
        labels(a).some((l) => ns.some((n) => namesMatch(n, l))) &&
        !labels(a).some((l) => chain.start && chain.start.label.split(" / ").some((s) => norm(s) === norm(l))),
    )
  );
}

export async function buildPlaceStory(lat: number, lng: number, emit?: (e: PlaceEvent) => void): Promise<PlaceStory> {
  const t0 = Date.now();
  let partial = false;
  const soft = <T>(p: Promise<T>, fallback: T): Promise<T> =>
    p.catch(() => {
      partial = true;
      return fallback;
    });

  // 1. Place name: Google (or free fallback) in parallel with the English geosearch.
  const geoEnP = soft(geosearch("en", lat, lng), [] as GeoPage[]);
  const resolved = await resolvePlace(lat, lng);
  const water = resolved.kind === "water";
  const lang = water ? "en" : localLang(resolved.countryCode);

  const datedP = soft(datedItemsAround(lat, lng, water ? 400 : 1.5, lang, water ? 40 : 60), [] as DatedItem[]);
  const geoLocP = lang !== "en" ? soft(geosearch(lang, lat, lng), [] as GeoPage[]) : Promise.resolve([] as GeoPage[]);

  const earlyGeo = await within(geoEnP, Math.max(80, 650 - (Date.now() - t0)), [] as GeoPage[]);
  // An article "is" the town/county when its title, minus ", State" and "(...)" qualifiers, is that name.
  const notAdmin = (title: string) => {
    const t = norm(title.replace(/\s*\(.*?\)\s*/g, " ").split(",")[0]);
    return ![resolved.locality, resolved.alt.locality, resolved.county, resolved.alt.county, resolved.region].some(
      (n) => n && (t === norm(n) || t === `${norm(n)} township`),
    );
  };
  // The spot: an article within 300 m, else (large sites like Nan Madol) the nearest within 600 m.
  const spotOf = (pages: GeoPage[]) =>
    pages.find((p) => p.distanceKm <= (resolved.locality ? 0.2 : 0.3) && notAdmin(p.title)) ??
    (resolved.locality
      ? undefined
      : pages.find((p) => p.distanceKm <= 0.6 && notAdmin(p.title) && !/school|station|hotel|airport/i.test(p.title)));
  const spotPage = water ? undefined : spotOf(earlyGeo);
  const place = toPlaceInfo(lat, lng, resolved, spotPage?.title ?? resolved.poi);
  emit?.({ type: "place", place });

  // 2. Admin chain (land) — verified by distance and P131 parents, started now, used for the timeline.
  const startNames = resolved.locality
    ? [resolved.locality, resolved.alt.locality]
    : resolved.county
      ? [resolved.county, resolved.alt.county]
      : [resolved.region, resolved.alt.region];
  const startLevel: "town" | "county" | "region" = resolved.locality ? "town" : resolved.county ? "county" : "region";
  const startNamesClean = Array.from(new Set(startNames.filter(Boolean) as string[]));
  const extraQids = earlyGeo
    .filter((p) => p.qid && startNamesClean.some((n) => namesMatch(n, p.title)))
    .map((p) => p.qid as string);
  const chainP: Promise<AdminChain> =
    water || !startNamesClean.length
      ? Promise.resolve({ ancestors: [] })
      : soft(
          resolveAdmin(startNamesClean, extraQids, lang, lat, lng, startLevel === "town" ? 30 : startLevel === "county" ? 150 : 1200),
          { ancestors: [] } as AdminChain,
        );

  // 3. Nearby: geosearch (en + local) enriched with Wikidata dates; wait for Wikidata at most until ~1.8 s.
  const geoEn = await geoEnP;
  const geoLoc = await within(geoLocP, Math.max(300, 1900 - (Date.now() - t0)), [] as GeoPage[]);
  const dated = await within(datedP, Math.max(0, 1800 - (Date.now() - t0)), [] as DatedItem[]);
  const datedByQid = new Map(dated.map((d) => [d.qid, d]));
  const enQids = new Set(geoEn.map((p) => p.qid).filter(Boolean));
  const geoAll = [...geoEn, ...geoLoc.filter((p) => !p.qid || !enQids.has(p.qid))].sort((a, b) => a.distanceKm - b.distanceKm);
  const nearby: NearbyItem[] = [];
  const nearbyQids = new Set<string>();
  for (const p of geoAll) {
    const d = p.qid ? datedByQid.get(p.qid) : undefined;
    if (p.qid) nearbyQids.add(p.qid);
    nearby.push({
      id: `${p.lang}wiki:${p.title}`,
      title: p.title,
      summary: firstSentence(p.intro, p.lang),
      lat: p.lat,
      lng: p.lng,
      distanceKm: round1(p.distanceKm),
      year: d?.year,
      dateLabel: d?.dateLabel,
      source: wikiSource(p.lang, p.title, p.url),
    });
  }
  for (const d of dated) {
    if (nearbyQids.has(d.qid) || (!d.enUrl && !d.localUrl)) continue;
    nearbyQids.add(d.qid);
    const source = d.enUrl
      ? wikiSource("en", d.enTitle ?? d.label, d.enUrl)
      : d.localUrl
        ? wikiSource(lang, d.localTitle ?? d.label, d.localUrl)
        : wikidataSource(d.qid, d.label);
    nearby.push({
      id: source.id,
      title: d.enTitle ?? d.label,
      lat: d.lat,
      lng: d.lng,
      distanceKm: round1(d.distanceKm),
      year: d.year,
      dateLabel: d.dateLabel,
      source,
    });
  }
  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearbyOut = nearby.slice(0, 30);
  emit?.({ type: "nearby", items: nearbyOut });

  // 4. Timeline sources.
  const cands: Candidate[] = [];
  const jobs: Promise<void>[] = [];
  let order = 0;
  const addFull = (
    l: string,
    title: string,
    mode: "all" | "history" | "history-only",
    scope: Scope,
    placeName: string,
    dist?: number,
    rankAdj = 0,
  ) => {
    const base = (order += 1000);
    jobs.push(
      soft(fullText(l, title), null).then((a) => {
        if (!a) return;
        const mined = mine(pickText(a.text, mode), l, scope, placeName, wikiSource(l, a.title, a.url), dist, base, rankAdj);
        if (rankAdj >= 2) for (const m of mined) m.sourceCap = 4;
        cands.push(...mined);
      }),
    );
  };

  const usedTitles = new Set<string>();
  let townName: string | undefined;
  let countyName: string | undefined;
  let regionName: string | undefined;
  let countryName: string | undefined = resolved.country;

  let islandNote: string | undefined;
  if (water) {
    const sea = place.name;
    const isl = await soft(islandsAround(lat, lng, 600), []);
    const nearest = isl[0];
    if (nearest) {
      const groupTitle = nearest.groupTitle ?? nearest.title;
      const groupName = nearest.groupLabel ?? nearest.label;
      addFull("en", groupTitle, "history", "sea", groupName, nearest.distanceKm);
      islandNote =
        groupTitle === nearest.title
          ? `${groupName} (${Math.round(nearest.distanceKm)} km away)`
          : `${groupName} (the nearest, ${nearest.label}, is ${Math.round(nearest.distanceKm)} km away)`;
    }
    if (sea !== "Open water") addFull("en", sea, "history", "sea", sea, undefined, nearest ? 3 : 0);
    // Dated things in this part of the water (islands, wrecks, battles) — their intros, verbatim.
    const withArticles = dated.filter((d) => d.enTitle).slice(0, 20);
    jobs.push(
      soft(intros("en", withArticles.map((d) => d.enTitle as string)), []).then((pages) => {
        for (const pg of pages) {
          const d = withArticles.find((x) => x.enTitle === pg.title);
          cands.push(...mine(pg.text, "en", "sea", pg.title, wikiSource("en", pg.title, pg.url), d?.distanceKm, (order += 1000), 0.5));
        }
      }),
    );
  } else {
    // Spot: articles within 300 m (not the town or county itself), whole article.
    const spots = geoAll.filter((p) => p.distanceKm <= (resolved.locality ? 0.2 : 0.3) && notAdmin(p.title)).slice(0, 2);
    if (!spots.length && spotPage) spots.push(spotPage);
    for (const p of spots) {
      usedTitles.add(`${p.lang}:${p.title}`);
      addFull(p.lang, p.title, "all", "spot", p.title, p.distanceKm);
    }
    // Nearby: intros of articles within 3 km.
    for (const p of geoAll.filter((p) => p.distanceKm <= 3 && notAdmin(p.title) && !spots.includes(p)).slice(0, 10)) {
      cands.push(...mine(p.intro, p.lang, "nearby", p.title, wikiSource(p.lang, p.title, p.url), p.distanceKm, (order += 1000)));
    }
    const chain = await chainP;
    const town = startLevel === "town" ? chain.start : undefined;
    const county = startLevel === "county" ? chain.start : pickAncestor(chain, [resolved.county, resolved.alt.county]);
    const region = startLevel === "region" ? chain.start : pickAncestor(chain, [resolved.region, resolved.alt.region]);
    const levels: [AdminArticle | undefined, Scope, "history" | "history-only", string | undefined][] = [
      [town, "town", "history", resolved.locality],
      [county, "county", "history", resolved.county],
      [region, "region", "history-only", resolved.region],
    ];
    for (const [a, scope, mode, name] of levels) {
      if (!a) continue;
      const placeName = name ?? a.label.split(" / ")[0];
      if (scope === "town") townName = placeName;
      if (scope === "county") countyName = placeName;
      if (scope === "region") regionName = placeName;
      if (a.enTitle && !usedTitles.has(`en:${a.enTitle}`)) {
        usedTitles.add(`en:${a.enTitle}`);
        addFull("en", a.enTitle, mode, scope, placeName, a.distanceKm);
      }
      // Local-language record for the town and county (the German Ortsgeschichte is often far richer).
      if (lang !== "en" && a.localTitle && scope !== "region" && !usedTitles.has(`${lang}:${a.localTitle}`)) {
        usedTitles.add(`${lang}:${a.localTitle}`);
        addFull(lang, a.localTitle, "history", scope, placeName, a.distanceKm);
      } else if (!a.enTitle && a.localTitle && !usedTitles.has(`${lang}:${a.localTitle}`)) {
        usedTitles.add(`${lang}:${a.localTitle}`);
        addFull(lang, a.localTitle, mode, scope, placeName, a.distanceKm);
      }
    }
    const country = chain.ancestors.find((a) => resolved.country && a.enTitle && namesMatch(resolved.country, a.label));
    if (country) countryName = resolved.country;
    await Promise.all(jobs);
    jobs.length = 0;
    if (cands.length < 6 && country?.enTitle) addFull("en", country.enTitle, "history-only", "country", resolved.country ?? country.label);
  }
  await Promise.all(jobs);

  const picked = select(cands);
  const timeline: TimelineEntry[] = picked.map((c, i) => ({
    id: `${c.source.id}#${c.order}-${i}`,
    year: c.year,
    dateLabel: c.dateLabel,
    era: eraForYear(c.year),
    text: c.text,
    lang: c.lang,
    scope: c.scope,
    placeName: c.placeName,
    distanceKm: c.distanceKm,
    source: c.source,
  }));

  const coverage = coverageFor(place.name, water, timeline, islandNote, { spot: spotPage?.title, town: townName, county: countyName, region: regionName, country: countryName });

  const sourceMap = new Map<string, Source>();
  for (const e of timeline) sourceMap.set(e.source.id, e.source);
  for (const n of nearbyOut) sourceMap.set(n.source.id, n.source);
  const sources = Array.from(sourceMap.values());

  if (partial) emit?.({ type: "notice", kind: "partial", message: "Some sources did not answer in time, so this story may be incomplete." });
  emit?.({ type: "timeline", entries: timeline, coverage, sources });

  return {
    place,
    nearby: nearbyOut,
    timeline,
    coverage,
    sources,
    generatedAt: new Date().toISOString(),
    engine: ENGINE,
  };
}

function coverageFor(
  name: string,
  water: boolean,
  timeline: TimelineEntry[],
  islandNote: string | undefined,
  n: { spot?: string; town?: string; county?: string; region?: string; country?: string },
): Coverage {
  if (water) {
    const where = name === "Open water" ? "this stretch of open water" : `this part of the ${name}`;
    return {
      level: "sea",
      note: islandNote
        ? `Open ocean. Nothing is recorded at this point; here is what's on record in ${where}, around ${islandNote}.`
        : `Open ocean. Nothing is recorded at this point; here is what's on record in ${where}.`,
    };
  }
  if (!timeline.length) {
    return { level: n.county ? "county" : "region", note: "Nothing dated is on record for this spot in the sources we checked." };
  }
  const best = timeline.reduce<Scope>((acc, e) => (SCOPE_RANK[e.scope] < SCOPE_RANK[acc] ? e.scope : acc), "country");
  const and = (a?: string, b?: string) => [a, b].filter(Boolean).join(" and ");
  switch (best) {
    case "spot":
      return { level: "spot", note: `This spot is on record: the story of ${n.spot ?? name}${n.town ? `, set in the story of ${n.town}` : ""}.` };
    case "nearby":
      return {
        level: "nearby",
        note: `Little is recorded at this exact spot; here is what's on record within a few kilometres${n.town || n.county ? `, and the story of ${and(n.town, n.county)}` : ""}.`,
      };
    case "town":
      return { level: "town", note: `Little is recorded at this exact spot, so this is the story of ${and(n.town, n.county)}.` };
    case "county":
      return { level: "county", note: `Little is recorded at this exact spot, so this is the story of ${and(n.county, n.region)}.` };
    case "region":
      return { level: "region", note: `Little is recorded near this spot, so this is the story of ${n.region ?? name}.` };
    default:
      return { level: best, note: `Little is recorded near this spot, so this is the story of ${n.country ?? name}.` };
  }
}
