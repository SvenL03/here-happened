"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResearchResult, HistoricalFact } from "@/lib/types";
import { FactCard } from "@/components/ui/fact-card";
import { Timeline, parseYear } from "@/components/ui/timeline";
import { researchLocationDeep } from "@/app/actions/research";
import { PHRASES, shufflePhrases } from "@/components/ui/loading-overlay";

const DEEP_DURATION = 30000;

function DeepResearchLoader() {
  const queue = useRef<string[]>(shufflePhrases(PHRASES));
  const indexRef = useRef(0);
  const [phase, setPhase] = useState<"intro" | "cycling">("intro");
  const [text, setText] = useState("Give us 20–30 seconds for a deep dive");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase("cycling"), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "cycling") return;
    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= queue.current.length) {
        queue.current = shufflePhrases(PHRASES);
        indexRef.current = 0;
      }
      setText(queue.current[indexRef.current]);
    }, 2500);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / DEEP_DURATION, 0.95));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const r = 20;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-xl border border-amber-500/20 mt-2">
      <div className="relative shrink-0 w-12 h-12">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="#27272a" strokeWidth="3" />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 24 24)"
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-amber-400 font-medium">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
      <span className="text-zinc-300 text-sm flex items-center">
        {text}
        <span className="inline-flex items-end gap-[2px] ml-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-amber-400 animate-bounce inline-block"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}

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
        className="bg-zinc-950 border-zinc-800 rounded-t-2xl max-h-[80vh] p-0"
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

            <div className="overflow-y-auto h-[calc(80vh-180px)] overscroll-contain">
              <div className="px-4 py-3 flex flex-col gap-3">
                {sortedFacts.map((fact, i) => (
                  <FactCard key={i} fact={fact} />
                ))}

                {!deepDone && lat && lng && (
                  deepLoading ? (
                    <DeepResearchLoader />
                  ) : (
                    <Button
                      onClick={handleDeepResearch}
                      className="mt-2 w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50"
                      variant="outline"
                    >
                      <Search size={14} className="mr-2" />
                      In-depth research
                    </Button>
                  )
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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
