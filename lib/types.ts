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
