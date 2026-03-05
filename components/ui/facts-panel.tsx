"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResearchResult, HistoricalFact } from "@/lib/types";
import { FactCard } from "@/components/ui/fact-card";
import { Timeline, parseYear } from "@/components/ui/timeline";
import { researchLocationDeep } from "@/app/actions/research";

function sortFactsByDate(facts: HistoricalFact[]): HistoricalFact[] {
  return [...facts].sort((a, b) => {
    const ya = parseYear(a.period);
    const yb = parseYear(b.period);
    if (ya === null && yb === null) return 0;
    if (ya === null) return 1;
    if (yb === null) return -1;
    return ya - yb;
  });
}

interface FactsPanelProps {
  result: ResearchResult | null;
  open: boolean;
  onClose: () => void;
  lat?: number;
  lng?: number;
}

export function FactsPanel({ result, open, onClose, lat, lng }: FactsPanelProps) {
  const [allFacts, setAllFacts] = useState<HistoricalFact[]>([]);
  const [allSources, setAllSources] = useState<ResearchResult["sources"]>([]);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepDone, setDeepDone] = useState(false);

  useEffect(() => {
    if (result) {
      setAllFacts(result.facts);
      setAllSources(result.sources);
      setDeepDone(false);
    }
  }, [result]);

  const handleDeepResearch = async () => {
    if (!lat || !lng || deepLoading) return;
    setDeepLoading(true);
    try {
      const deep = await researchLocationDeep(lat, lng);
      setAllFacts((prev) => {
        const existingTitles = new Set(prev.map((f) => f.title.toLowerCase()));
        const newFacts = deep.facts.filter(
          (f) => !existingTitles.has(f.title.toLowerCase())
        );
        return [...prev, ...newFacts];
      });
      setAllSources((prev) => {
        const existingUrls = new Set(prev.map((s) => s.url));
        const newSources = deep.sources.filter((s) => !existingUrls.has(s.url));
        return [...prev, ...newSources];
      });
      setDeepDone(true);
    } catch {
      // silently fail
    } finally {
      setDeepLoading(false);
    }
  };

  const sortedFacts = sortFactsByDate(allFacts);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-zinc-950 border-zinc-800 rounded-t-2xl max-h-[80vh] p-0 flex flex-col"
      >
        {result && (
          <>
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-zinc-800 shrink-0">
              <SheetTitle className="text-zinc-100 text-lg font-semibold text-left">
                {result.locationName}
              </SheetTitle>
              <p className="text-zinc-400 text-sm leading-relaxed text-left">
                {result.summary}
              </p>
            </SheetHeader>

            <div className="shrink-0">
              <Timeline facts={sortedFacts} />
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-3 flex flex-col gap-3">
                {sortedFacts.map((fact, i) => (
                  <FactCard key={i} fact={fact} />
                ))}

                {!deepDone && lat && lng && (
                  <Button
                    onClick={handleDeepResearch}
                    disabled={deepLoading}
                    className="mt-2 w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50"
                    variant="outline"
                  >
                    {deepLoading ? (
                      <>
                        <Search size={14} className="mr-2 animate-pulse" />
                        Researching deeply...
                      </>
                    ) : (
                      <>
                        <Search size={14} className="mr-2" />
                        In-depth research
                      </>
                    )}
                  </Button>
                )}

                {allSources.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-zinc-800">
                    <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-widest font-medium">
                      Sources
                    </p>
                    {allSources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors py-1"
                      >
                        <ExternalLink size={11} />
                        {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
