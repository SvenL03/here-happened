"use client";

import type { HistoricalFact } from "@/lib/types";

export function parseYear(period?: string): number | null {
  if (!period) return null;

  if (/BCE|BC/i.test(period)) {
    const m = period.match(/(\d+)/);
    if (m) return -parseInt(m[1]);
  }

  const yearMatch = period.match(/\b(\d{4})\b/);
  if (yearMatch) return parseInt(yearMatch[1]);

  const decadeMatch = period.match(/\b(\d{3,4})s\b/);
  if (decadeMatch) return parseInt(decadeMatch[1]);

  const centuryMatch = period.match(/(\d+)(?:st|nd|rd|th)\s+[Cc]entury/);
  if (centuryMatch) return (parseInt(centuryMatch[1]) - 1) * 100 + 50;

  if (/ancient|prehistoric/i.test(period)) return -3000;

  return null;
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`;
  if (year < 1000) return `${year} AD`;
  return `${year}`;
}

interface TimelineProps {
  facts: HistoricalFact[];
}

export function Timeline({ facts }: TimelineProps) {
  const factsWithYears = facts
    .map((f) => ({ ...f, year: parseYear(f.period) }))
    .filter((f): f is typeof f & { year: number } => f.year !== null)
    .sort((a, b) => a.year - b.year);

  if (factsWithYears.length < 2) return null;

  const minYear = factsWithYears[0].year;
  const maxYear = factsWithYears[factsWithYears.length - 1].year;
  const range = maxYear - minYear || 1;

  const PADDING = 48;
  const totalWidth = Math.max(500, factsWithYears.length * 80 + PADDING * 2);
  const usableWidth = totalWidth - PADDING * 2;

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/50">
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" as const }}>
        <div style={{ width: totalWidth, height: 64 }} className="relative">
          {/* Timeline line */}
          <div
            className="absolute bg-zinc-700"
            style={{ top: 36, left: PADDING, width: usableWidth, height: 1 }}
          />

          {factsWithYears.map((f, i) => {
            const pct = (f.year - minYear) / range;
            const x = PADDING + pct * usableWidth;

            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: x, transform: "translateX(-50%)", top: 8 }}
              >
                <span className="text-[9px] text-zinc-500 leading-tight whitespace-nowrap">
                  {formatYear(f.year)}
                </span>
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-3" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
