/**
 * Store: cache, rate limits and the daily spend cap.
 * STUB — the infra helper replaces these bodies with Neon-backed versions.
 * Every function must degrade gracefully (no throw) when DATABASE_URL is missing.
 */
import type { PlaceStory } from "@/lib/contract";

export async function getCachedStory(_key: string): Promise<PlaceStory | null> {
  return null;
}

export async function putCachedStory(_key: string, _story: PlaceStory): Promise<void> {}

/** Per-visitor limit for uncached lookups. ipHash is a salted hash, never the raw IP. */
export async function checkRateLimit(_ipHash: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  return { ok: true };
}

/** Paid calls only (today: Google Geocoding). units = number of calls. */
export async function recordSpend(_kind: "geocode", _units: number): Promise<void> {}

/** False once today's paid calls pass the cap; the engine then uses its free fallback. */
export async function underDailyCap(_kind: "geocode"): Promise<boolean> {
  return true;
}

export async function hashVisitor(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${process.env.VISITOR_SALT ?? "here-happened"}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
