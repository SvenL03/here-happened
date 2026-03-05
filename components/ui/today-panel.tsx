"use client";

import { useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { TodayEvent } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  battle: "bg-amber-900/80 text-amber-200 border-amber-800",
  person: "bg-blue-900/80 text-blue-200 border-blue-800",
  event: "bg-rose-900/80 text-rose-200 border-rose-800",
  culture: "bg-purple-900/80 text-purple-200 border-purple-800",
  geography: "bg-green-900/80 text-green-200 border-green-800",
  trivia: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

function getTodayLabel() {
  const now = new Date();
  return now.toLocaleString("en-US", { month: "long", day: "numeric" });
}

interface TodayPanelProps {
  events: TodayEvent[];
  open: boolean;
  onClose: () => void;
  activeIndex: number;
  onActiveChange: (index: number) => void;
}

export function TodayPanel({
  events,
  open,
  onClose,
  activeIndex,
  onActiveChange,
}: TodayPanelProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!open || events.length === 0) return;

    observerRef.current?.disconnect();

    const ratios = new Array(events.length).fill(0);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
          if (idx !== -1) ratios[idx] = entry.intersectionRatio;
        });
        const best = ratios.indexOf(Math.max(...ratios));
        if (best !== -1) onActiveChange(best);
      },
      {
        root: scrollRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    cardRefs.current.forEach((el) => {
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [open, events.length, onActiveChange]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-zinc-950 border-zinc-800 rounded-t-2xl max-h-[70vh] p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <SheetTitle className="text-zinc-100 text-lg font-semibold text-left">
            Today in History
          </SheetTitle>
          <p className="text-amber-400 text-sm font-medium text-left">
            {getTodayLabel()}
          </p>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3"
          style={{ maxHeight: "calc(70vh - 100px)" }}
        >
          {events.map((event, i) => (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el; }}
              className={`rounded-xl border p-4 transition-colors ${
                i === activeIndex
                  ? "bg-zinc-900 border-amber-500/60"
                  : "bg-zinc-900 border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-zinc-100 font-medium text-sm leading-tight">
                  {event.title}
                </h3>
                <Badge
                  variant="outline"
                  className={`text-[11px] shrink-0 capitalize ${
                    CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.trivia
                  }`}
                >
                  {event.category}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-400 text-xs font-bold">{event.year}</span>
                <span className="text-zinc-600 text-xs">·</span>
                <span className="text-zinc-500 text-xs">{event.locationName}</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {event.description}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
