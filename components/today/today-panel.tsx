"use client";
/**
 * On This Day: Wikipedia's selected anniversaries for the visitor's local date,
 * kept only when the event links to a page with real coordinates. Picking an
 * item flies the map to that page's place. Text is Wikipedia's, verbatim.
 */
import { useEffect, useState } from "react";
import { ExternalLink, MapPin, X } from "lucide-react";
import type { TodayItem, TodayResult } from "@/lib/today";

export interface TodayPanelProps {
  onPick: (p: { lat: number; lng: number; title: string }) => void;
  onClose: () => void;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayResult };

function yearText(y: number): string {
  return y < 0 ? `${Math.abs(y)} BCE` : String(y);
}

export function TodayPanel({ onPick, onClose }: TodayPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [today] = useState(() => new Date());
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dateLabel = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/today?m=${month}&d=${day}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error ?? `Request failed (${r.status})`);
        setState({ status: "ready", data: body as TodayResult });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Couldn’t load today’s list." });
      });
    return () => ctrl.abort();
  }, [month, day, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      aria-labelledby="hh-today-title"
      className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_10px_30px_-12px_rgba(26,29,33,0.35)]"
    >
      <header className="flex items-start gap-3 border-b border-[var(--ink)] px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-2 font-[family-name:var(--f-ui)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
            <span aria-hidden className="inline-block size-[7px] rounded-full bg-[var(--accent)]" />
            {dateLabel}
          </p>
          <h2
            id="hh-today-title"
            className="m-0 mt-1 font-[family-name:var(--f-display)] text-[19px] font-medium leading-snug tracking-[-0.01em]"
          >
            On this day, from Wikipedia&rsquo;s selected anniversaries
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close On this day"
          className="-mr-2 -mt-1.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[var(--ink)] hover:bg-[var(--paper-deep)]"
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      {state.status === "loading" && <p className="sr-only">Loading today&rsquo;s anniversaries&hellip;</p>}
      {state.status === "loading" && (
        <ul className="m-0 list-none p-0" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex gap-4 border-b border-[var(--paper-deeper)] px-4 py-3.5 last:border-b-0">
              <div className="h-6 w-12 animate-pulse rounded-[2px] bg-[var(--paper-deep)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-full animate-pulse rounded-[2px] bg-[var(--paper-deep)]" />
                <div className="h-3 w-4/5 animate-pulse rounded-[2px] bg-[var(--paper-deep)]" />
                <div className="h-3 w-1/3 animate-pulse rounded-[2px] bg-[var(--paper-deep)]" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <div className="px-4 py-5 text-[14px] leading-relaxed">
          <p className="m-0 text-[var(--ink-soft)]">{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((a) => a + 1);
            }}
            className="mt-3 cursor-pointer rounded-full border border-[var(--ink)] bg-transparent px-3.5 py-1.5 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--paper-deep)]"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && state.data.items.length === 0 && (
        <p className="m-0 px-4 py-5 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          None of today&rsquo;s anniversaries link to a page with a place on the map, so there is nothing to pin. We
          don&rsquo;t guess locations.
        </p>
      )}

      {state.status === "ready" && state.data.items.length > 0 && (
        <ol className="m-0 list-none p-0">
          {state.data.items.map((item) => (
            <TodayRow key={`${item.year}-${item.title}-${item.text.slice(0, 24)}`} item={item} onPick={onPick} />
          ))}
        </ol>
      )}

      {state.status === "ready" && (
        <footer className="border-t border-[var(--ink)] px-4 py-2.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">
          Event text from{" "}
          <a href={state.data.source.url} target="_blank" rel="noreferrer" className="text-[var(--ink)] underline underline-offset-2">
            Wikipedia
          </a>{" "}
          (CC BY-SA 4.0), unchanged. Each pin sits on the place of a page the event links to.
          {state.data.dropped > 0 ? ` ${state.data.dropped} more had no mapped place and are left out.` : ""}
        </footer>
      )}
    </section>
  );
}

function TodayRow({ item, onPick }: { item: TodayItem; onPick: TodayPanelProps["onPick"] }) {
  return (
    <li className="group border-b border-[var(--paper-deeper)] last:border-b-0">
      <button
        type="button"
        onClick={() => onPick({ lat: item.lat, lng: item.lng, title: item.title })}
        className="flex w-full cursor-pointer gap-4 border-0 bg-transparent px-4 pb-1.5 pt-3.5 text-left text-[var(--ink)] hover:bg-[var(--paper-deep)] focus-visible:bg-[var(--paper-deep)]"
      >
        <span className="w-[3.4rem] shrink-0 pt-px font-[family-name:var(--f-display)] text-[26px] font-medium leading-none tabular-nums tracking-[-0.02em]">
          {yearText(item.year)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-[1.45]">{item.text}</span>
          <span className="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--accent-text)]">
            <MapPin size={13} aria-hidden className="shrink-0" />
            <span className="truncate">{item.title}</span>
          </span>
        </span>
      </button>
      <div className="flex pb-2.5 pl-[5.4rem] pr-4">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          Source: Wikipedia, &ldquo;{item.title}&rdquo;
          <ExternalLink size={11} aria-hidden />
        </a>
      </div>
    </li>
  );
}
