import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HistoricalFact } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  battle: "bg-amber-900/80 text-amber-200 border-amber-800",
  person: "bg-blue-900/80 text-blue-200 border-blue-800",
  event: "bg-rose-900/80 text-rose-200 border-rose-800",
  culture: "bg-purple-900/80 text-purple-200 border-purple-800",
  geography: "bg-green-900/80 text-green-200 border-green-800",
  trivia: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

export function FactCard({ fact }: { fact: HistoricalFact }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-zinc-100 font-medium text-sm leading-tight">
            {fact.title}
          </h3>
          <Badge
            variant="outline"
            className={`text-[11px] shrink-0 capitalize ${
              CATEGORY_COLORS[fact.category] ?? CATEGORY_COLORS.trivia
            }`}
          >
            {fact.category}
          </Badge>
        </div>
        {fact.period && (
          <p className="text-amber-400/70 text-xs mb-1.5 font-medium">
            {fact.period}
          </p>
        )}
        <p className="text-zinc-400 text-sm leading-relaxed">
          {fact.description}
        </p>
      </CardContent>
    </Card>
  );
}
