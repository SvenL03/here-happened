"use server";

import { searchLocation, searchLocationDeep } from "@/lib/perplexity";
import type { ResearchResult } from "@/lib/types";

export async function researchLocation(
  lat: number,
  lng: number
): Promise<ResearchResult> {
  try {
    return await searchLocation(lat, lng);
  } catch (error) {
    console.error("Research failed:", error);
    throw new Error("Failed to research this location. Please try again.");
  }
}

export async function researchLocationDeep(
  lat: number,
  lng: number
): Promise<ResearchResult> {
  try {
    return await searchLocationDeep(lat, lng);
  } catch (error) {
    console.error("Deep research failed:", error);
    throw new Error("Failed to deep research this location. Please try again.");
  }
}
