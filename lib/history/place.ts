/**
 * Place resolution: Google reverse geocode (paid, capped) → free OSM Nominatim fallback.
 * Open water gets a deterministic name from a coarse box table. Names are never guessed.
 */
import type { PlaceInfo, PlaceLevel } from "@/lib/contract";
import { placeKey } from "@/lib/contract";
import { recordSpend, underDailyCap } from "@/lib/store";
import { UA, getJson, norm } from "./net";

export interface Resolved {
  kind: "land" | "water";
  via: "google" | "nominatim" | "boxes";
  /** Names per level, as found (local spelling allowed). */
  locality?: string;
  county?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  /** Alternative spellings per level (e.g. English plus-code names), used only for matching. */
  alt: { locality?: string; county?: string; region?: string; country?: string };
  /** Point-of-interest name from Google, if any (used only when no Wikipedia article sits at the spot). */
  poi?: string;
  /** Water body name for kind = "water". */
  water?: string;
  geocodeCalls: number;
}

interface GComp {
  long_name: string;
  short_name: string;
  types: string[];
}
interface GResult {
  types: string[];
  address_components: GComp[];
}

const BUSINESS = /^(food|restaurant|cafe|bar|store|hair_care|beauty_salon|lodging|health|doctor|dentist|finance|bank|atm|car_|gas_station|real_estate|lawyer|insurance|clothing|shopping|supermarket|grocery|pharmacy|gym|spa|laundry|plumber|electrician|moving_company|travel_agency|storage|veterinary|florist|bakery|meal_|night_club|liquor|jewelry|shoe|furniture|hardware|home_goods|electronics|book_store|pet_store|convenience|department_store|parking|post_office|school|primary_school|secondary_school|accounting|insurance_agency|general_contractor|roofing|painter|locksmith|car_repair|car_dealer|car_wash)/;

const NOT_A_NAME = new Set([
  "transit_station", "bus_station", "train_station", "subway_station", "light_rail_station", "route", "street_address",
  "premise", "subpremise", "plus_code", "street_number", "postal_code", "intersection",
]);

function firstOfType(results: GResult[], type: string): string | undefined {
  for (const r of results) {
    if (!r.types.includes(type)) continue;
    const c = r.address_components.find((c) => c.types.includes(type));
    if (c) return c.long_name;
  }
  return undefined;
}

function compOf(r: GResult | undefined, type: string): GComp | undefined {
  return r?.address_components.find((c) => c.types.includes(type));
}

function samePrefix(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return norm(a).slice(0, 3) === norm(b).slice(0, 3);
}

export async function geocodeGoogle(lat: number, lng: number): Promise<Resolved | null> {
  const key = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
  if (!key) return null;
  if (!(await underDailyCap("geocode").catch(() => false))) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${encodeURIComponent(key)}`;
  let data: { status: string; results?: GResult[] };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    data = (await res.json()) as typeof data;
  } catch {
    return null; // never surface the URL (it holds the key)
  } finally {
    recordSpend("geocode", 1).catch(() => {});
  }
  const results = data.results ?? [];
  const meaningful = results.filter((r) => !r.types.includes("plus_code"));
  if (data.status === "ZERO_RESULTS" || meaningful.length === 0) {
    return { kind: "water", via: "boxes", alt: {}, geocodeCalls: 1, water: waterName(lat, lng) };
  }
  if (data.status !== "OK") return null;

  const countryComp = compOf(results.find((r) => r.types.includes("country")), "country") ?? compOf(meaningful[0], "country");
  const countryCode = countryComp?.short_name?.toLowerCase();
  // Containment results (a result whose own type is the level) are polygon matches: the truth for identity.
  const locality = firstOfType(results, "locality") ?? firstOfType(results, "postal_town");
  const useL3AsCounty = countryCode === "de" || countryCode === "at";
  const county = useL3AsCounty
    ? firstOfType(results, "administrative_area_level_3") ?? firstOfType(results, "administrative_area_level_2")
    : firstOfType(results, "administrative_area_level_2") ?? compOf(meaningful[0], "administrative_area_level_2")?.long_name;
  const region = firstOfType(results, "administrative_area_level_1") ?? compOf(meaningful[0], "administrative_area_level_1")?.long_name;
  const country = countryComp?.long_name;

  // The plus-code result tends to carry English names; use them for display only when they agree with containment.
  const plus = results.find((r) => r.types.includes("plus_code"));
  const plusLoc = compOf(plus, "locality")?.long_name;
  const plusCounty = compOf(plus, useL3AsCounty ? "administrative_area_level_3" : "administrative_area_level_2")?.long_name;
  const plusRegion = compOf(plus, "administrative_area_level_1")?.long_name;

  // A Google POI names the spot only when it is a landmark, park or natural feature: never a stop, street, building or shop.
  let poi: string | undefined;
  for (const r of meaningful.slice(0, 6)) {
    if (r.types.some((t) => BUSINESS.test(t) || NOT_A_NAME.has(t))) continue;
    if (!r.types.some((t) => ["tourist_attraction", "natural_feature", "park", "point_of_interest", "place_of_worship", "museum"].includes(t))) continue;
    const c = r.address_components.find(
      (c) =>
        !c.types.some((t) => NOT_A_NAME.has(t)) &&
        c.types.some((t) => ["natural_feature", "park", "point_of_interest", "establishment", "tourist_attraction"].includes(t)),
    );
    if (c && !/^\d/.test(c.long_name) && !/\+/.test(c.long_name)) {
      poi = c.long_name;
      break;
    }
  }

  return {
    kind: "land",
    via: "google",
    locality: samePrefix(locality, plusLoc) ? plusLoc : locality,
    county: samePrefix(county, plusCounty) ? plusCounty : county,
    region: samePrefix(region, plusRegion) ? plusRegion : region,
    country,
    countryCode,
    alt: { locality, county, region, country },
    poi,
    geocodeCalls: 1,
  };
}

interface Nominatim {
  error?: string;
  name?: string;
  address?: Record<string, string>;
}

export async function geocodeNominatim(lat: number, lng: number): Promise<Resolved | null> {
  try {
    const d = await getJson<Nominatim>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`,
      3000,
    );
    if (d.error || !d.address) return { kind: "water", via: "boxes", alt: {}, geocodeCalls: 0, water: waterName(lat, lng) };
    const a = d.address;
    return {
      kind: "land",
      via: "nominatim",
      locality: a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality,
      county: a.county ?? a.state_district,
      region: a.state ?? a.region ?? a.province,
      country: a.country,
      countryCode: a.country_code?.toLowerCase(),
      alt: {},
      geocodeCalls: 0,
    };
  } catch {
    return null;
  }
}

export async function resolvePlace(lat: number, lng: number): Promise<Resolved> {
  const g = await geocodeGoogle(lat, lng);
  if (g) return g;
  const n = await geocodeNominatim(lat, lng);
  if (n) return n;
  return { kind: "land", via: "boxes", alt: {}, geocodeCalls: 0 };
}

export function toPlaceInfo(lat: number, lng: number, r: Resolved, spotName?: string): PlaceInfo {
  const hierarchy: PlaceLevel[] = [];
  if (r.locality) hierarchy.push({ level: "locality", name: r.locality });
  if (r.county) hierarchy.push({ level: "county", name: r.county });
  if (r.region) hierarchy.push({ level: "region", name: r.region });
  if (r.country) hierarchy.push({ level: "country", name: r.country });
  if (r.kind === "water") {
    return {
      key: placeKey(lat, lng),
      lat,
      lng,
      name: r.water ?? "Open water",
      context: "Open water",
      kind: "water",
      hierarchy: [],
    };
  }
  const name = spotName ?? r.locality ?? r.county ?? r.region ?? r.country ?? "Unnamed place";
  const context = hierarchy
    .map((h) => h.name)
    .filter((n) => n !== name)
    .join(", ");
  return { key: placeKey(lat, lng), lat, lng, name, context, kind: "land", hierarchy, countryCode: r.countryCode };
}

/**
 * Coarse, deterministic water-body boxes: [name, latMin, latMax, lngMin, lngMax]. Seas first, oceans last.
 * A point outside every box is called "Open water". This names a region; it never claims a distance.
 */
const WATER_BOXES: [string, number, number, number, number][] = [
  ["Mediterranean Sea", 30, 46, -6, 36],
  ["Black Sea", 40.5, 47.5, 27.3, 42],
  ["Caspian Sea", 36.5, 47.5, 46.5, 55],
  ["Red Sea", 12.5, 30, 32, 44],
  ["Persian Gulf", 23.5, 30.5, 47.5, 57],
  ["Baltic Sea", 53.5, 66, 9.5, 30.5],
  ["North Sea", 51, 61, -4, 9.5],
  ["Gulf of Mexico", 18, 31, -98, -81],
  ["Caribbean Sea", 9, 22, -88, -60],
  ["Hudson Bay", 51, 64, -95, -77],
  ["Bay of Bengal", 5, 23, 80, 95],
  ["Arabian Sea", 5, 25, 51, 77],
  ["South China Sea", 0, 23, 105, 121],
  ["Philippine Sea", 5, 35, 121, 145],
  ["East China Sea", 23, 33, 117, 131],
  ["Sea of Japan", 33, 52, 127, 142],
  ["Sea of Okhotsk", 43, 62, 135, 165],
  ["Bering Sea", 52, 66, 162, 180],
  ["Bering Sea", 52, 66, -180, -157],
  ["Coral Sea", -30, -9, 142, 165],
  ["Tasman Sea", -45, -30, 147, 175],
  ["Gulf of Alaska", 50, 61, -158, -130],
  ["Arctic Ocean", 66, 90, -180, 180],
  ["Southern Ocean", -90, -60, -180, 180],
  ["Indian Ocean", -60, 30, 20, 147],
  ["Pacific Ocean", -60, 0, -180, -76],
  ["Pacific Ocean", 0, 15, -180, -84],
  ["Pacific Ocean", 15, 66, -180, -105],
  ["Atlantic Ocean", -60, 0, -70, 20],
  ["Atlantic Ocean", 0, 66, -100, 0],
  ["Atlantic Ocean", 0, 66, 0, 10],
  ["Pacific Ocean", -60, 66, 100, 180],
  ["Pacific Ocean", -60, 66, -180, -70],
];

export function waterName(lat: number, lng: number): string {
  for (const [name, a, b, c, d] of WATER_BOXES) if (lat >= a && lat <= b && lng >= c && lng <= d) return name;
  return "Open water";
}

export { UA };
