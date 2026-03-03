"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink } from "lucide-react";
import type { ResearchResult } from "@/lib/types";
import { FactCard } from "@/components/ui/fact-card";

interface FactsPanelProps {
  result: ResearchResult | null;
  open: boolean;
  onClose: () => void;
}

export function FactsPanel({ result, open, onClose }: FactsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-zinc-950 border-zinc-800 rounded-t-2xl max-h-[80vh] p-0"
      >
        {result && (
          <>
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-zinc-800">
              <SheetTitle className="text-zinc-100 text-lg font-semibold text-left">
                {result.locationName}
              </SheetTitle>
              <p className="text-zinc-400 text-sm leading-relaxed text-left">
                {result.summary}
              </p>
            </SheetHeader>

            <ScrollArea className="h-[calc(80vh-140px)]">
              <div className="px-4 py-3 flex flex-col gap-3">
                {result.facts.map((fact, i) => (
                  <FactCard key={i} fact={fact} />
                ))}

                {result.sources.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-zinc-800">
                    <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-widest font-medium">
                      Sources
                    </p>
                    {result.sources.map((s, i) => (
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
