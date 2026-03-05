import OpenAI from "openai";
import type { ResearchResult } from "@/lib/types";

const client = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});

export async function searchLocation(
  lat: number,
  lng: number
): Promise<ResearchResult> {
  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [
      {
        role: "system",
        content: `You are a historian, storyteller, and trivia expert specializing in local history. Given geographic coordinates, research and return the most fascinating, surprising, and lesser-known historical facts about that specific location.

Focus on:
- Battles, wars, sieges, and military history
- Famous people born, lived, or died there
- Founding stories and origin tales
- Major historical events and turning points
- Archaeological discoveries
- Unusual trivia, records, crimes, or disasters
- Cultural significance and traditions

Be specific to the EXACT location, not just the general region. Include approximate dates. Make it engaging and surprising.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "locationName": "specific name of this place",
  "summary": "2-3 sentence overview of what makes this place historically significant",
  "facts": [
    {
      "title": "short compelling title",
      "description": "2-3 sentence explanation with specific details",
      "period": "time period, e.g. 1850s, Ancient Rome, 12th Century",
      "category": "battle|person|event|culture|geography|trivia"
    }
  ],
  "sources": [
    { "title": "source name", "url": "source url" }
  ]
}`,
      },
      {
        role: "user",
        content: `What interesting historical events, facts, and stories are associated with the location at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}? Give me 4-5 fascinating facts.`,
      },
    ],
    web_search_options: {
      search_context_size: "high",
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from Perplexity");

  // Strip markdown code fences if Perplexity wraps the JSON
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned) as ResearchResult;
  } catch {
    // If JSON is truncated, try to extract what we can
    const nameMatch = cleaned.match(/"locationName"\s*:\s*"([^"]+)"/);
    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]+)"/);

    return {
      locationName: nameMatch?.[1] ?? `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
      summary: summaryMatch?.[1] ?? "Could not fully load results. Try tapping again.",
      facts: [],
      sources: [],
    };
  }
}

export async function searchLocationOnThisDay(
  lat: number,
  lng: number
): Promise<ResearchResult> {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const day = now.getDate();
  const dateStr = `${month} ${day}`;

  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [
      {
        role: "system",
        content: `You are a historian specializing in local history and calendar-based events. Given geographic coordinates and a specific calendar date (month and day), find historical events that occurred on that exact date in any year at or near that location.

Focus on events that happened specifically on this calendar date:
- Battles won or lost on this day
- Famous births or deaths
- Founding or surrender of cities
- Treaties signed or broken
- Disasters, crimes, or miracles
- Political events, elections, coups
- Scientific discoveries announced

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "locationName": "specific name of this place",
  "summary": "2-3 sentences about what makes this date significant for this location",
  "facts": [
    {
      "title": "short compelling title",
      "description": "2-3 sentence explanation with the specific year and details",
      "period": "the specific year, e.g. 1865",
      "category": "battle|person|event|culture|geography|trivia"
    }
  ],
  "sources": [
    { "title": "source name", "url": "source url" }
  ]
}`,
      },
      {
        role: "user",
        content: `What historical events happened on ${dateStr} (this exact calendar date, any year) at or near the location at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}? Give me 4-6 events specifically tied to this date.`,
      },
    ],
    web_search_options: {
      search_context_size: "high",
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from Perplexity");

  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned) as ResearchResult;
  } catch {
    const nameMatch = cleaned.match(/"locationName"\s*:\s*"([^"]+)"/);
    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]+)"/);

    return {
      locationName: nameMatch?.[1] ?? `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
      summary: summaryMatch?.[1] ?? "Could not fully load results. Try tapping again.",
      facts: [],
      sources: [],
    };
  }
}

export async function searchLocationDeep(
  lat: number,
  lng: number
): Promise<ResearchResult> {
  const response = await client.chat.completions.create({
    model: "sonar",
    messages: [
      {
        role: "system",
        content: `You are a historian, storyteller, and trivia expert specializing in local history. Given geographic coordinates, research and return the most fascinating, surprising, and lesser-known historical facts about that specific location.

Focus on:
- Battles, wars, sieges, and military history
- Famous people born, lived, or died there
- Founding stories and origin tales
- Major historical events and turning points
- Archaeological discoveries
- Unusual trivia, records, crimes, or disasters
- Cultural significance and traditions
- Economic history, trade, and industry
- Political history and governance
- Religious and spiritual history

Be specific to the EXACT location, not just the general region. Include approximate dates. Make it engaging and surprising. Cover as wide a time range as possible, from ancient to modern.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "locationName": "specific name of this place",
  "summary": "2-3 sentence overview of what makes this place historically significant",
  "facts": [
    {
      "title": "short compelling title",
      "description": "2-3 sentence explanation with specific details",
      "period": "time period, e.g. 1850s, Ancient Rome, 12th Century",
      "category": "battle|person|event|culture|geography|trivia"
    }
  ],
  "sources": [
    { "title": "source name", "url": "source url" }
  ]
}`,
      },
      {
        role: "user",
        content: `Give me a comprehensive deep-dive into the complete history of the location at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}. Provide 10-12 detailed historical facts covering as wide a time range as possible, from ancient times to the present day.`,
      },
    ],
    web_search_options: {
      search_context_size: "high",
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from Perplexity");

  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned) as ResearchResult;
  } catch {
    const nameMatch = cleaned.match(/"locationName"\s*:\s*"([^"]+)"/);
    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]+)"/);

    return {
      locationName: nameMatch?.[1] ?? `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
      summary: summaryMatch?.[1] ?? "Could not fully load results. Try tapping again.",
      facts: [],
      sources: [],
    };
  }
}
