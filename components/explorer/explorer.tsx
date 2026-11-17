"use client";
/** STUB — the frontend helper replaces this with the real map + story screen. */
import type { PlaceStory } from "@/lib/contract";

export interface ExplorerProps {
  initial?: { lat: number; lng: number };
  initialStory?: PlaceStory | null;
}

export function Explorer(_props: ExplorerProps) {
  return <div>Here Happened</div>;
}
