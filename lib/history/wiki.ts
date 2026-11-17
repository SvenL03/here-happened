/** Wikipedia + Wikidata fetchers. Every result carries the real URL it came from. */
import type { Source } from "@/lib/contract";
import { distanceKm, getJson, namesMatch, norm } from "./net";

export interface GeoPage {
  lang: string;
  title: string;
  url: string;
  lat: number;
  lng: number;
  distanceKm: number;
  qid?: string;
  intro: string;
}

interface ApiPage {
  pageid?: number;
  title: string;
  missing?: boolean;
  fullurl?: string;
  extract?: string;
  coordinates?: { lat: number; lon: number }[];
  pageprops?: { wikibase_item?: string; disambiguation?: string };
}

const api = (lang: string) => `https://${lang}.wikipedia.org/w/api.php`;

export function wikiSource(lang: string, title: string, url: string): Source {
  return { id: `${lang}wiki:${title}`, title, url, publisher: "Wikipedia", lang };
}

export function wikidataSource(qid: string, label: string): Source {
  return { id: `wikidata:${qid}`, title: label, url: `https://www.wikidata.org/wiki/${qid}`, publisher: "Wikidata", lang: "en" };
}

/** Articles with coordinates within `radiusM` (max 10 km), nearest first, with their plain-text intros. */
export async function geosearch(lang: string, lat: number, lng: number, radiusM = 10000, limit = 20): Promise<GeoPage[]> {
  const u =
    `${api(lang)}?action=query&format=json&formatversion=2&generator=geosearch&ggscoord=${lat}%7C${lng}` +
    `&ggsradius=${Math.min(10000, radiusM)}&ggslimit=${limit}&prop=coordinates%7Cpageprops%7Cextracts%7Cinfo` +
    `&ppprop=wikibase_item%7Cdisambiguation&exintro=1&explaintext=1&exlimit=20&inprop=url&colimit=${limit}`;
  const d = await getJson<{ query?: { pages?: ApiPage[] } }>(u, 3500);
  const out: GeoPage[] = [];
  for (const p of d.query?.pages ?? []) {
    const c = p.coordinates?.[0];
    if (!c || !p.fullurl || p.pageprops?.disambiguation !== undefined) continue;
    if (/^(List of|Liste der|Liste von|Liste des|Elenco|Anexo:)/i.test(p.title)) continue;
    out.push({
      lang,
      title: p.title,
      url: p.fullurl,
      lat: c.lat,
      lng: c.lon,
      distanceKm: distanceKm(lat, lng, c.lat, c.lon),
      qid: p.pageprops?.wikibase_item,
      intro: p.extract ?? "",
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Whole article as plain text with `== Heading ==` markers. */
export async function fullText(lang: string, title: string): Promise<{ title: string; url: string; text: string } | null> {
  const u =
    `${api(lang)}?action=query&format=json&formatversion=2&prop=extracts%7Cinfo&explaintext=1&exsectionformat=wiki` +
    `&inprop=url&redirects=1&titles=${encodeURIComponent(title)}`;
  const d = await getJson<{ query?: { pages?: ApiPage[] } }>(u, 4500);
  const p = d.query?.pages?.[0];
  if (!p || p.missing || !p.extract || !p.fullurl) return null;
  return { title: p.title, url: p.fullurl, text: p.extract };
}

/** Plain-text intros for up to 20 titles in one call. */
export async function intros(lang: string, titles: string[]): Promise<{ title: string; url: string; text: string }[]> {
  if (!titles.length) return [];
  const u =
    `${api(lang)}?action=query&format=json&formatversion=2&prop=extracts%7Cinfo&exintro=1&explaintext=1&exlimit=20` +
    `&inprop=url&redirects=1&titles=${encodeURIComponent(titles.slice(0, 20).join("|"))}`;
  const d = await getJson<{ query?: { pages?: ApiPage[] } }>(u, 4000);
  return (d.query?.pages ?? [])
    .filter((p) => !p.missing && p.extract && p.fullurl)
    .map((p) => ({ title: p.title, url: p.fullurl as string, text: p.extract as string }));
}

/* ---------------- Wikidata ---------------- */

const SPARQL = "https://query.wikidata.org/sparql";

interface Binding {
  [k: string]: { value: string } | undefined;
}

export async function sparql(query: string, timeoutMs = 6000): Promise<Binding[]> {
  const d = await getJson<{ results: { bindings: Binding[] } }>(
    `${SPARQL}?format=json&query=${encodeURIComponent(query)}`,
    timeoutMs,
    { Accept: "application/sparql-results+json" },
  );
  return d.results.bindings;
}

export async function searchEntities(name: string, lang: string, limit = 20): Promise<string[]> {
  const u =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=${limit}` +
    `&language=${lang}&uselang=${lang}&search=${encodeURIComponent(name)}`;
  const d = await getJson<{ search?: { id: string }[] }>(u, 3000);
  return (d.search ?? []).map((s) => s.id);
}

function parsePoint(wkt?: string): { lat: number; lng: number } | null {
  const m = wkt?.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
  return m ? { lng: Number(m[1]), lat: Number(m[2]) } : null;
}

function titleFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/\/wiki\/(.+)$/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : undefined;
}

export interface AdminArticle {
  qid: string;
  label: string;
  enTitle?: string;
  localTitle?: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
}

export interface AdminChain {
  start?: AdminArticle; // the matched locality (or county / region when that is the smallest level we have)
  ancestors: AdminArticle[]; // P131 ancestors of start
}

/**
 * Find the Wikidata item for `name` that really is near the point (≤ maxKm), then its P131 ancestors.
 * This is what stops "Cedarville" resolving to the wrong Cedarville, or Iowa to the wrong county.
 */
export async function resolveAdmin(
  names: string[],
  extraQids: string[],
  lang: string,
  lat: number,
  lng: number,
  maxKm: number,
): Promise<AdminChain> {
  const langs = Array.from(new Set(["en", lang]));
  const searches = await Promise.all(
    names.flatMap((n) => langs.map((l) => searchEntities(n, l).catch(() => [] as string[]))),
  );
  const ids = Array.from(new Set([...extraQids, ...searches.flat()])).slice(0, 60);
  if (!ids.length) return { ancestors: [] };
  const L = lang;
  const q = `
SELECT ?item ?coord ?itemLabelEn ?itemLabelLoc ?itemEn ?itemLoc ?anc ?ancLabelEn ?ancLabelLoc ?ancEn ?ancLoc ?ancCoord WHERE {
  VALUES ?item { ${ids.map((i) => `wd:${i}`).join(" ")} }
  ?item wdt:P625 ?coord .
  FILTER(geof:distance(?coord, "Point(${lng} ${lat})"^^geo:wktLiteral) < ${maxKm})
  OPTIONAL { ?item rdfs:label ?itemLabelEn FILTER(lang(?itemLabelEn) = "en") }
  OPTIONAL { ?item rdfs:label ?itemLabelLoc FILTER(lang(?itemLabelLoc) = "${L}") }
  OPTIONAL { ?itemEn schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?itemLoc schema:about ?item ; schema:isPartOf <https://${L}.wikipedia.org/> }
  OPTIONAL {
    ?item wdt:P131+ ?anc .
    OPTIONAL { ?anc rdfs:label ?ancLabelEn FILTER(lang(?ancLabelEn) = "en") }
    OPTIONAL { ?anc rdfs:label ?ancLabelLoc FILTER(lang(?ancLabelLoc) = "${L}") }
    OPTIONAL { ?ancEn schema:about ?anc ; schema:isPartOf <https://en.wikipedia.org/> }
    OPTIONAL { ?ancLoc schema:about ?anc ; schema:isPartOf <https://${L}.wikipedia.org/> }
    OPTIONAL { ?anc wdt:P625 ?ancCoord }
  }
} LIMIT 600`;
  const rows = await sparql(q, 6000);
  type Cand = AdminArticle & { labels: string[]; anc: Map<string, AdminArticle & { labels: string[] }> };
  const cands = new Map<string, Cand>();
  for (const r of rows) {
    const qid = r.item!.value.split("/").pop()!;
    const pt = parsePoint(r.coord?.value);
    let c = cands.get(qid);
    if (!c) {
      c = {
        qid,
        label: r.itemLabelEn?.value ?? r.itemLabelLoc?.value ?? qid,
        labels: [r.itemLabelEn?.value, r.itemLabelLoc?.value].filter(Boolean) as string[],
        enTitle: titleFromUrl(r.itemEn?.value),
        localTitle: titleFromUrl(r.itemLoc?.value),
        lat: pt?.lat,
        lng: pt?.lng,
        distanceKm: pt ? distanceKm(lat, lng, pt.lat, pt.lng) : undefined,
        anc: new Map(),
      };
      cands.set(qid, c);
    }
    if (r.anc) {
      const aq = r.anc.value.split("/").pop()!;
      if (!c.anc.has(aq)) {
        const ap = parsePoint(r.ancCoord?.value);
        c.anc.set(aq, {
          qid: aq,
          label: r.ancLabelEn?.value ?? r.ancLabelLoc?.value ?? aq,
          labels: [r.ancLabelEn?.value, r.ancLabelLoc?.value].filter(Boolean) as string[],
          enTitle: titleFromUrl(r.ancEn?.value),
          localTitle: titleFromUrl(r.ancLoc?.value),
          lat: ap?.lat,
          lng: ap?.lng,
          distanceKm: ap ? distanceKm(lat, lng, ap.lat, ap.lng) : undefined,
        });
      }
    }
  }
  // Exact name matches first ("Sac County", not "Sac County Courthouse"), then the nearest.
  const exact = (c: Cand) =>
    c.labels.some((l) => names.some((n) => norm(l) === norm(n))) ||
    [c.enTitle, c.localTitle].some((t) => t && names.some((n) => norm(t.split(",")[0].replace(/\s*\(.*\)/, "")) === norm(n)));
  const matching = Array.from(cands.values())
    .filter((c) => (c.enTitle || c.localTitle) && c.labels.some((l) => names.some((n) => namesMatch(n, l))))
    .sort((a, b) => Number(exact(b)) - Number(exact(a)) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  const best = matching[0];
  if (!best) return { ancestors: [] };
  return {
    start: { qid: best.qid, label: best.label, enTitle: best.enTitle, localTitle: best.localTitle, lat: best.lat, lng: best.lng, distanceKm: best.distanceKm },
    ancestors: Array.from(best.anc.values()).map((a) => ({ ...a, label: a.labels.join(" / ") || a.label })),
  };
}

export interface DatedItem {
  qid: string;
  label: string;
  lat: number;
  lng: number;
  distanceKm: number;
  year: number;
  dateLabel: string;
  enTitle?: string;
  enUrl?: string;
  localTitle?: string;
  localUrl?: string;
}

const PROP_WORD: Record<string, string> = {
  P571: "est.",
  P1619: "opened",
  P580: "from",
  P585: "",
  P576: "ended",
};
const PROP_ORDER = ["P571", "P1619", "P580", "P585", "P576"];

/**
 * Dated Wikidata items around the point (inception, opening, start, point in time, dissolution).
 * Only year-or-better precision is kept. `water` widens the radius and adds shipwrecks, islands, battles.
 */
export async function datedItemsAround(lat: number, lng: number, radiusKm: number, lang: string, limit = 60): Promise<DatedItem[]> {
  const q = `
SELECT ?item ?itemLabel ?coord ?dist ?p ?t ?prec ?en ?loc WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${radiusKm}" . bd:serviceParam wikibase:distance ?dist . }
  VALUES (?p ?pp ?ps) { ("P571" p:P571 psv:P571) ("P1619" p:P1619 psv:P1619) ("P580" p:P580 psv:P580) ("P585" p:P585 psv:P585) ("P576" p:P576 psv:P576) }
  ?item ?pp ?st . ?st ?ps ?v . ?v wikibase:timeValue ?t ; wikibase:timePrecision ?prec .
  FILTER(?prec >= 9)
  MINUS { ?item wdt:P31 ?abstract . VALUES ?abstract { wd:Q3887 wd:Q3542 wd:Q141022 wd:Q1457376 wd:Q11173 } }
  OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?loc schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,${lang}" . }
} ORDER BY ?dist LIMIT ${limit * 3}`;
  const rows = await sparql(q, 6000);
  const byItem = new Map<string, DatedItem & { rank: number }>();
  for (const r of rows) {
    const qid = r.item!.value.split("/").pop()!;
    const prop = r.p!.value;
    const rank = PROP_ORDER.indexOf(prop);
    const t = r.t!.value; // e.g. "1816-01-01T00:00:00Z" or "-0071-01-01T00:00:00Z"
    const m = t.match(/^(-?)(\d{1,})-/);
    if (!m) continue;
    const y = Number(m[2]) * (m[1] ? -1 : 1);
    if (!Number.isFinite(y) || y === 0 || y > new Date().getUTCFullYear()) continue;
    const pt = parsePoint(r.coord?.value);
    if (!pt) continue;
    const label = r.itemLabel?.value ?? qid;
    if (/^Q\d+$/.test(label)) continue; // no readable label
    const prev = byItem.get(qid);
    if (prev && prev.rank <= rank) continue;
    const yearText = y < 0 ? `${-y} BC` : `${y}`;
    byItem.set(qid, {
      qid,
      label,
      lat: pt.lat,
      lng: pt.lng,
      distanceKm: Number(r.dist?.value ?? distanceKm(lat, lng, pt.lat, pt.lng)),
      year: y,
      dateLabel: `${PROP_WORD[prop]} ${yearText}`.trim(),
      enUrl: r.en?.value,
      enTitle: titleFromUrl(r.en?.value),
      localUrl: r.loc?.value,
      localTitle: titleFromUrl(r.loc?.value),
      rank,
    });
  }
  return Array.from(byItem.values())
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ rank: _rank, ...rest }) => rest);
}

export interface Island {
  qid: string;
  label: string;
  title: string;
  distanceKm: number;
  groupLabel?: string;
  groupTitle?: string;
}

/** Nearest islands / atolls / archipelagos with an English article, with the island group they belong to (P361). */
export async function islandsAround(lat: number, lng: number, radiusKm: number): Promise<Island[]> {
  const q = `
SELECT ?item ?itemLabel ?dist ?en ?group ?groupLabel ?groupEn WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${radiusKm}" . bd:serviceParam wikibase:distance ?dist . }
  ?item wdt:P31 ?t . VALUES ?t { wd:Q23442 wd:Q33837 wd:Q42523 wd:Q1402592 wd:Q12204 }
  ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL {
    ?item wdt:P361 ?group . ?group wdt:P31 ?gt . VALUES ?gt { wd:Q33837 wd:Q1402592 }
    ?groupEn schema:about ?group ; schema:isPartOf <https://en.wikipedia.org/> .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} ORDER BY ?dist LIMIT 20`;
  const rows = await sparql(q, 6000);
  const out: Island[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const qid = r.item!.value.split("/").pop()!;
    if (seen.has(qid)) continue;
    seen.add(qid);
    const title = titleFromUrl(r.en?.value);
    if (!title) continue;
    out.push({
      qid,
      label: r.itemLabel?.value ?? title,
      title,
      distanceKm: Number(r.dist?.value ?? 0),
      groupLabel: r.groupLabel?.value,
      groupTitle: titleFromUrl(r.groupEn?.value),
    });
  }
  return out;
}
