import type { Scope, TimelineEntry } from "@/lib/contract";

export function fmtCoords(lat: number, lng: number): string {
  const la = `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? "E" : "W"}`;
  return `${la}, ${lo}`;
}

export function fmtKm(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export const SCOPE_ORDER: Scope[] = ["spot", "nearby", "town", "county", "region", "country"];

export const SCOPE_NAME: Record<Scope, string> = {
  spot: "At this spot",
  nearby: "Nearby",
  town: "Town",
  county: "County",
  region: "Region",
  country: "Country",
  sea: "At sea",
};

export function scopeLabel(e: Pick<TimelineEntry, "scope" | "distanceKm" | "placeName">): string {
  switch (e.scope) {
    case "spot":
      return "At this spot";
    case "nearby":
      return e.distanceKm != null ? `Nearby · ${fmtKm(e.distanceKm)}` : "Nearby";
    case "sea":
      return "At sea";
    default:
      return `${SCOPE_NAME[e.scope]} · ${e.placeName}`;
  }
}

let dn: Intl.DisplayNames | null = null;
export function langName(code: string): string {
  try {
    dn ??= new Intl.DisplayNames(["en"], { type: "language" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export function yearSpan(entries: TimelineEntry[]): string {
  if (!entries.length) return "";
  const ys = entries.map((e) => e.year);
  const f = (y: number) => (y < 0 ? `${Math.abs(y).toLocaleString("en-US")} BCE` : y < 1000 ? `AD ${y}` : String(y));
  const a = Math.min(...ys);
  const b = Math.max(...ys);
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
}
