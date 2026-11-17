/**
 * Server-side story loader shared by the place page, its metadata and its share image.
 * Order: Neon cache → build with the engine → write back to the cache.
 * React cache() dedupes within one request (page + generateMetadata); the small
 * in-process memo dedupes across requests on the same instance (page + OG image)
 * and is what makes it cheap when there is no database.
 */
import { cache } from "react";
import { buildPlaceStory } from "@/lib/history";
import { getCachedStory, putCachedStory } from "@/lib/store";
import { placeKey, snap, type PlaceStory, type TimelineEntry } from "@/lib/contract";

const MEMO_MAX = 200;
const MEMO_TTL_MS = 60 * 60 * 1000;
const memo = new Map<string, { at: number; story: Promise<PlaceStory | null> }>();

async function load(key: string, lat: number, lng: number): Promise<PlaceStory | null> {
  try {
    const cached = await getCachedStory(key);
    if (cached) return cached;
  } catch (err) {
    console.error("[story-server] cache read failed", err);
  }
  try {
    const story = await buildPlaceStory(lat, lng);
    if (story.engine !== "stub") {
      putCachedStory(key, story).catch((err) => console.error("[story-server] cache write failed", err));
    }
    return story;
  } catch (err) {
    console.error("[story-server] build failed", key, err);
    return null;
  }
}

/** The story for a point, or null when the engine failed (the client then loads it itself). */
export const getStory = cache(async (lat: number, lng: number): Promise<PlaceStory | null> => {
  const la = snap(lat);
  const ln = snap(lng);
  const key = placeKey(la, ln);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.story;
  const story = load(key, la, ln);
  memo.set(key, { at: Date.now(), story });
  // A failed build should not stick for an hour.
  story.then((s) => {
    if (!s) memo.delete(key);
  });
  if (memo.size > MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  return story;
});

/** Year as a reader would say it: 1816, 72 AD stays 72, BCE for negatives. */
export function yearLabel(year: number): string {
  if (year < 0) return `${Math.abs(year).toLocaleString("en-US")} BCE`;
  return String(year);
}

const SCOPE_RANK: Record<string, number> = { spot: 0, nearby: 1, town: 2, county: 3, region: 4, country: 5, sea: 3 };

const ORIGIN = /\b(built|founded|established|began|completed|opened|settled|incorporated|platted|laid out|erected|consecrated|chartered)\b/i;

function strength(e: TimelineEntry): number {
  const t = e.text.trim();
  let s = 0;
  if (ORIGIN.test(t)) s += 2; // how the place came to be reads best as a lead
  if (t.length >= 60 && t.length <= 260) s += 1;
  return s;
}

/** The first strong sentence of the timeline: closest scope, then an origin sentence of readable length, then earliest. */
export function leadEntry(story: PlaceStory): TimelineEntry | null {
  const good = story.timeline.filter((e) => e.text && e.text.trim().length >= 40);
  const pool = good.length ? good : story.timeline;
  if (!pool.length) return null;
  return [...pool].sort(
    (a, b) => (SCOPE_RANK[a.scope] ?? 9) - (SCOPE_RANK[b.scope] ?? 9) || strength(b) - strength(a) || a.year - b.year,
  )[0];
}

/** A label that names a year ("1816", "c. 72 AD", "13,000 BCE"), not a span ("2nd century BC"). */
const YEARISH = /^(c\.\s?)?(AD\s)?(\d{1,4}|\d{1,3}(,\d{3})+)s?(\s?(AD|BC|BCE|CE))?$/;

/**
 * 3–5 dates spread across the timeline, oldest first, shown with the timeline's own labels
 * (never a computed midpoint: "2nd century BC" sorts as -150 but must not print as "150 BCE").
 */
const STRIP_SCOPE_RANK: Record<string, number> = { spot: 0, nearby: 1, town: 2, sea: 2, county: 3, region: 4, country: 5 };

/** A few dates for the share image: closest to the pin first (the spot, nearby, the town), then spread across time. */
export function dateStrip(story: PlaceStory, max = 5): string[] {
  const seen = new Set<string>();
  const cands = story.timeline
    .map((e, i) => ({ label: e.dateLabel?.trim() ?? "", year: e.year, rank: STRIP_SCOPE_RANK[e.scope] ?? 9, i }))
    .filter((c) => c.label && c.label.length <= 13 && (YEARISH.test(c.label) || c.label.length <= 9))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
  const closest = cands.filter((c) => c.rank <= 3);
  const pool = closest.length >= 3 ? closest : cands;
  pool.sort((a, b) => a.year - b.year);
  if (pool.length <= max) return pool.map((c) => c.label);
  const out: string[] = [];
  for (let k = 0; k < max; k++) out.push(pool[Math.round((k * (pool.length - 1)) / (max - 1))].label);
  return [...new Set(out)];
}

export function trimTo(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

export function formatCoords(lat: number, lng: number): string {
  const la = `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}`;
  const ln = `${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? "E" : "W"}`;
  return `${la}, ${ln}`;
}
