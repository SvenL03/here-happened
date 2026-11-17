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

/** A date label as printed in the panel header: bare years under 1000 get "AD". */
function spanLabel(e: TimelineEntry): string {
  const l = e.dateLabel.trim();
  return /^\d{1,3}$/.test(l) ? `AD ${l}` : l;
}

/**
 * "13,000 BC to 2002": the first and last entries' own date labels, never a computed midpoint
 * (a "2nd century BC" entry sorts as -150 but must not print as "150 BCE"). When at least three entries come from
 * the spot, nearby or the town, only those set the span, so a region-wide prehistory doesn't stretch it.
 */
export function yearSpan(entries: TimelineEntry[]): string {
  if (!entries.length) return "";
  const close = entries.filter((e) => e.scope === "spot" || e.scope === "nearby" || e.scope === "town" || e.scope === "sea");
  const pool = (close.length >= 3 ? close : entries).slice().sort((a, b) => a.year - b.year);
  const a = spanLabel(pool[0]);
  const b = spanLabel(pool[pool.length - 1]);
  return a === b ? a : `${a} to ${b}`;
}

/** The source link with a text fragment, so the browser scrolls to and highlights the quoted sentence. */
export function sourceHref(url: string, text: string): string {
  if (url.includes("#")) return url;
  const words = text.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
  if (words.length < 12) return url;
  const enc = encodeURIComponent(words).replace(/-/g, "%2D").replace(/'/g, "%27");
  return `${url}#:~:text=${enc}`;
}
