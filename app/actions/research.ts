"use server";

import { searchLocation } from "@/lib/perplexity";
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
