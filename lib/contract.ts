/**
 * The contract between the history engine (lib/history, app/api/place),
 * the store (lib/store.ts) and the UI (components/explorer, app/place).
 *
 * Rule zero of this app: nothing is invented. Every timeline entry is a
 * sentence taken from a real, openable source, and says which source.
 */

/** How far from the pin a piece of history belongs. Widening order: spot → nearby → town → county → region → country. "sea" is for open water. */
export type Scope = "spot" | "nearby" | "town" | "county" | "region" | "country" | "sea";

export type EraId =
  | "deep" // before 3000 BCE
  | "ancient" // 3000 BCE – 499 AD
  | "medieval" // 500 – 1499
  | "early-modern" // 1500 – 1799
  | "19c" // 1800 – 1899
  | "20c" // 1900 – 1999
  | "recent"; // 2000 –

export const ERAS: { id: EraId; label: string; from: number; to: number }[] = [
  { id: "deep", label: "Deep past", from: -1_000_000, to: -3001 },
  { id: "ancient", label: "Ancient", from: -3000, to: 499 },
  { id: "medieval", label: "Medieval", from: 500, to: 1499 },
  { id: "early-modern", label: "Early modern", from: 1500, to: 1799 },
  { id: "19c", label: "1800s", from: 1800, to: 1899 },
  { id: "20c", label: "1900s", from: 1900, to: 1999 },
  { id: "recent", label: "Recent", from: 2000, to: 9999 },
];

export function eraForYear(year: number): EraId {
  for (const e of ERAS) if (year >= e.from && year <= e.to) return e.id;
  return year < 0 ? "deep" : "recent";
}

export interface Source {
  id: string; // stable within one story, e.g. "enwiki:Cedarville, Ohio"
  title: string; // page title as shown to the reader
  url: string; // the page the reader can open (must be a real URL we fetched)
  publisher: string; // "Wikipedia", "Wikidata", ...
  lang: string; // "en", "de", ...
}

export interface PlaceLevel {
  level: "locality" | "county" | "region" | "country";
  name: string;
}

export interface PlaceInfo {
  key: string; // placeKey(lat, lng)
  lat: number;
  lng: number;
  name: string; // short label: "Cedarville" / "Colosseum" / "Pacific Ocean"
  context: string; // "Greene County, Ohio, United States"
  kind: "land" | "water";
  hierarchy: PlaceLevel[]; // smallest first
  countryCode?: string; // ISO 3166-1 alpha-2, lower case
}

export interface TimelineEntry {
  id: string;
  year: number; // negative = BCE; used to sort and position
  dateLabel: string; // "1816", "c. 72 AD", "4 March 1865", "1850s"
  era: EraId;
  text: string; // verbatim sentence(s) from the source, only trimmed
  lang: string; // language of `text`
  scope: Scope;
  placeName: string; // what the entry is about: "Cedarville", "Greene County"
  distanceKm?: number;
  source: Source;
}

export interface NearbyItem {
  id: string;
  title: string;
  summary?: string; // first sentence of the source, verbatim
  lat: number;
  lng: number;
  distanceKm: number;
  year?: number;
  dateLabel?: string;
  source: Source;
}

export interface Coverage {
  level: Scope; // the closest scope we found real history for
  note: string; // honest one-liner: "Little is recorded at this exact spot, so this is the story of Cedarville and Greene County."
}

export interface PlaceStory {
  place: PlaceInfo;
  nearby: NearbyItem[];
  timeline: TimelineEntry[];
  coverage: Coverage;
  sources: Source[]; // every source used, deduplicated
  generatedAt: string; // ISO
  engine: string; // e.g. "wiki-v1"
}

/** One line of the NDJSON stream from GET /api/place?lat=&lng= */
export type PlaceEvent =
  | { type: "place"; place: PlaceInfo }
  | { type: "nearby"; items: NearbyItem[] }
  | { type: "timeline"; entries: TimelineEntry[]; coverage: Coverage; sources: Source[] }
  | { type: "notice"; kind: "rate-limited" | "over-budget" | "partial"; message: string }
  | { type: "error"; message: string }
  | { type: "done"; cached: boolean; ms: number };

/** Coordinates snap to 3 decimals (~110 m). The key is also the share-link path: /place/41.890,12.492 */
export const KEY_DECIMALS = 3;

export function snap(n: number): number {
  return Number(n.toFixed(KEY_DECIMALS));
}

export function placeKey(lat: number, lng: number): string {
  return `${snap(lat).toFixed(KEY_DECIMALS)},${snap(lng).toFixed(KEY_DECIMALS)}`;
}

export function parsePlaceKey(raw: string): { lat: number; lng: number } | null {
  const m = decodeURIComponent(raw).match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: snap(lat), lng: snap(lng) };
}

export function placePath(lat: number, lng: number): string {
  return `/place/${placeKey(lat, lng)}`;
}
