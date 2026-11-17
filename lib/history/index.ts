/**
 * STUB — the engine helper replaces this with the real implementation.
 * buildPlaceStory gathers sourced history for a point and calls `emit` as each part is ready.
 */
import type { PlaceEvent, PlaceStory } from "@/lib/contract";
import { placeKey } from "@/lib/contract";

export async function buildPlaceStory(
  lat: number,
  lng: number,
  emit?: (e: PlaceEvent) => void,
): Promise<PlaceStory> {
  const story: PlaceStory = {
    place: { key: placeKey(lat, lng), lat, lng, name: "Somewhere", context: "", kind: "land", hierarchy: [] },
    nearby: [],
    timeline: [],
    coverage: { level: "region", note: "Stub engine." },
    sources: [],
    generatedAt: new Date().toISOString(),
    engine: "stub",
  };
  emit?.({ type: "place", place: story.place });
  return story;
}
