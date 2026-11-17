"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Coverage, NearbyItem, PlaceEvent, PlaceInfo, PlaceStory, Source, TimelineEntry } from "@/lib/contract";
import { cedarvilleFixture } from "./fixtures";

export type Notice = { kind: "rate-limited" | "over-budget" | "partial" | "offline"; message: string };

export interface StoryState {
  status: "idle" | "loading" | "done" | "error";
  point: { lat: number; lng: number } | null;
  place: PlaceInfo | null;
  nearby: NearbyItem[] | null; // null = still coming
  timeline: TimelineEntry[] | null; // null = still coming
  coverage: Coverage | null;
  sources: Source[] | null;
  notices: Notice[];
  error: string | null;
}

const EMPTY: StoryState = {
  status: "idle",
  point: null,
  place: null,
  nearby: null,
  timeline: null,
  coverage: null,
  sources: null,
  notices: [],
  error: null,
};

export function stateFromStory(story: PlaceStory): StoryState {
  return {
    status: "done",
    point: { lat: story.place.lat, lng: story.place.lng },
    place: story.place,
    nearby: story.nearby,
    timeline: story.timeline,
    coverage: story.coverage,
    sources: story.sources,
    notices: [],
    error: null,
  };
}

function apply(s: StoryState, e: PlaceEvent): StoryState {
  switch (e.type) {
    case "place":
      return { ...s, place: e.place };
    case "nearby":
      return { ...s, nearby: e.items };
    case "timeline":
      return { ...s, timeline: e.entries, coverage: e.coverage, sources: e.sources };
    case "notice":
      return { ...s, notices: [...s.notices, { kind: e.kind, message: e.message }] };
    case "error":
      return { ...s, status: "error", error: e.message };
    case "done":
      return {
        ...s,
        status: s.status === "error" ? "error" : "done",
        nearby: s.nearby ?? [],
        timeline: s.timeline ?? [],
        sources: s.sources ?? [],
      };
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

/** Streams /api/place NDJSON into React state, aborting the previous request when a new point is loaded. */
export function usePlaceStory(initialStory?: PlaceStory | null) {
  const [state, setState] = useState<StoryState>(() => (initialStory ? stateFromStory(initialStory) : EMPTY));
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const load = useCallback(async (lat: number, lng: number) => {
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    setState({ ...EMPTY, status: "loading", point: { lat, lng } });
    const push = (e: PlaceEvent) => {
      if (!ac.signal.aborted) setState((s) => apply(s, e));
    };

    const useFixture = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fixture");
    try {
      if (useFixture) {
        const f = cedarvilleFixture;
        await sleep(250, ac.signal);
        push({ type: "place", place: { ...f.place, lat, lng } });
        await sleep(700, ac.signal);
        push({ type: "nearby", items: f.nearby });
        await sleep(900, ac.signal);
        push({ type: "timeline", entries: f.timeline, coverage: f.coverage, sources: f.sources });
        push({ type: "done", cached: false, ms: 1850 });
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setState((s) => ({
          ...s,
          status: "error",
          error: null,
          notices: [{ kind: "offline", message: "You're offline. Reconnect and tap the map again." }],
        }));
        return;
      }
      const res = await fetch(`/api/place?lat=${lat}&lng=${lng}`, { signal: ac.signal });
      if (res.status === 429) {
        push({ type: "notice", kind: "rate-limited", message: "Lots of people are exploring right now. Give it a minute and try again." });
        push({ type: "done", cached: false, ms: 0 });
        return;
      }
      if (!res.ok || !res.body) throw new Error(`The history service answered ${res.status}.`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let sawDone = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line) as PlaceEvent;
            if (ev.type === "done") sawDone = true;
            push(ev);
          } catch {
            /* skip a malformed line */
          }
        }
      }
      const tail = buf.trim();
      if (tail) {
        try {
          const ev = JSON.parse(tail) as PlaceEvent;
          if (ev.type === "done") sawDone = true;
          push(ev);
        } catch {}
      }
      if (!sawDone) push({ type: "done", cached: false, ms: 0 });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setState((s) => ({
        ...s,
        status: "error",
        error: offline ? null : (err as Error)?.message || "Something went wrong.",
        notices: offline ? [...s.notices, { kind: "offline", message: "You're offline. Reconnect and tap the map again." }] : s.notices,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    ctrl.current?.abort();
    setState(EMPTY);
  }, []);

  return { state, load, reset };
}
