export interface HistoricalFact {
  title: string;
  description: string;
  period?: string;
  category: "battle" | "person" | "event" | "culture" | "geography" | "trivia";
}

export interface ResearchResult {
  locationName: string;
  summary: string;
  facts: HistoricalFact[];
  sources: { title: string; url: string }[];
}

export interface TodayEvent {
  title: string;
  description: string;
  year: number;
  locationName: string;
  lat: number;
  lng: number;
  category: "battle" | "person" | "event" | "culture" | "geography" | "trivia";
}
