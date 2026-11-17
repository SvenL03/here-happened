/**
 * GET /api/place?lat=&lng=[&format=json]
 * Streams NDJSON PlaceEvents (one JSON object per line) as the story is built; format=json returns the whole PlaceStory.
 */
import type { PlaceEvent, PlaceStory } from "@/lib/contract";
import { parsePlaceKey, placeKey } from "@/lib/contract";
import { buildPlaceStory } from "@/lib/history";
import { checkRateLimit, getCachedStory, hashVisitor, putCachedStory } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NDJSON = "application/x-ndjson; charset=utf-8";
const CACHE_OK = "public, s-maxage=86400, stale-while-revalidate=604800";

function replay(story: PlaceStory): PlaceEvent[] {
  return [
    { type: "place", place: story.place },
    { type: "nearby", items: story.nearby },
    { type: "timeline", entries: story.timeline, coverage: story.coverage, sources: story.sources },
  ];
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = parsePlaceKey(`${url.searchParams.get("lat") ?? ""},${url.searchParams.get("lng") ?? ""}`);
  const asJson = url.searchParams.get("format") === "json";
  if (!parsed) {
    return Response.json({ type: "error", message: "lat and lng must be numbers (lat -90..90, lng -180..180)." }, { status: 400 });
  }
  const { lat, lng } = parsed;
  const key = placeKey(lat, lng);
  const t0 = Date.now();

  const cached = await getCachedStory(key).catch(() => null);
  if (cached) {
    if (asJson) return Response.json(cached, { headers: { "Cache-Control": CACHE_OK, "X-Cache": "hit" } });
    const lines = [...replay(cached), { type: "done", cached: true, ms: Date.now() - t0 } as PlaceEvent];
    return new Response(lines.map((e) => JSON.stringify(e)).join("\n") + "\n", {
      headers: { "Content-Type": NDJSON, "Cache-Control": CACHE_OK, "X-Cache": "hit" },
    });
  }

  const limit = await checkRateLimit(await hashVisitor(clientIp(req))).catch(() => ({ ok: true }) as { ok: boolean; retryAfterSec?: number });
  if (!limit.ok) {
    const message = "You're exploring fast. Give it a minute, then tap again.";
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (limit.retryAfterSec) headers["Retry-After"] = String(limit.retryAfterSec);
    if (asJson) return Response.json({ type: "notice", kind: "rate-limited", message }, { status: 429, headers });
    const lines: PlaceEvent[] = [
      { type: "notice", kind: "rate-limited", message },
      { type: "done", cached: false, ms: Date.now() - t0 },
    ];
    return new Response(lines.map((e) => JSON.stringify(e)).join("\n") + "\n", {
      status: 429,
      headers: { ...headers, "Content-Type": NDJSON },
    });
  }

  if (asJson) {
    try {
      const story = await buildPlaceStory(lat, lng);
      await putCachedStory(key, story).catch(() => {});
      return Response.json(story, { headers: { "Cache-Control": CACHE_OK, "X-Cache": "miss" } });
    } catch {
      return Response.json({ type: "error", message: "Could not build the story for this place." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: PlaceEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const story = await buildPlaceStory(lat, lng, send);
        await putCachedStory(key, story).catch(() => {});
        send({ type: "done", cached: false, ms: Date.now() - t0 });
      } catch {
        send({ type: "error", message: "Could not build the story for this place." });
        send({ type: "done", cached: false, ms: Date.now() - t0 });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": NDJSON,
      // A fresh build is cached at the edge too; partial stories are rare and still sourced.
      "Cache-Control": CACHE_OK,
      "X-Accel-Buffering": "no",
      "X-Cache": "miss",
    },
  });
}
