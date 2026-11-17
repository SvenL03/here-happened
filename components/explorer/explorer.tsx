"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, LocateFixed, Minus, Plus } from "lucide-react";
import { placePath, snap, type PlaceStory } from "@/lib/contract";
import { TodayPanel } from "@/components/today/today-panel";
import { MapCanvas, type MapApi } from "./map-canvas";
import { SearchBox } from "./search-box";
import { StoryPanel } from "./story-panel";
import { usePlaceStory } from "./use-place-story";

export interface ExplorerProps {
  initial?: { lat: number; lng: number };
  initialStory?: PlaceStory | null;
}

const PANEL_W = 460; // desktop side panel incl. gutter
const PEEK = 188; // phone sheet peek height

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const f = () => setPhone(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return phone;
}

function Wordmark() {
  return (
    <Link href="/" className="hh-wordmark" aria-label="Here Happened, home">
      <svg viewBox="0 0 32 30" width="18" height="17" aria-hidden className="hh-wordmark-mark">
        <path d="M16 2 L30 27 L2 27 Z" />
        <circle cx="16" cy="18.5" r="3.2" />
      </svg>
      <span>Here Happened</span>
    </Link>
  );
}

export function Explorer({ initial, initialStory }: ExplorerProps) {
  const { state, load } = usePlaceStory(initialStory);
  const mapApi = useRef<MapApi | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phone = useIsPhone();
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const dragged = useRef(false);
  const todayBtn = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [todayOpen, setTodayOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [offline, setOffline] = useState(false);

  const startPoint = initial ?? (initialStory ? { lat: initialStory.place.lat, lng: initialStory.place.lng } : null);
  const point = state.point ?? startPoint;

  // A share link with a point but no story yet: load it.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (initial && !initialStory) load(initial.lat, initial.lng);
  }, [initial, initialStory, load]);

  useEffect(() => {
    const f = () => setOffline(!navigator.onLine);
    f();
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Keep the tab title in step with the place on screen.
  const placeName = state.place?.name;
  useEffect(() => {
    if (!placeName) return;
    document.title = `${placeName}: what happened here · Here Happened`;
  }, [placeName]);

  const pick = useCallback(
    (lat: number, lng: number, opts?: { fly?: boolean; zoom?: number }) => {
      const la = snap(lat);
      const lo = snap(((lng + 540) % 360) - 180);
      if (opts?.fly) mapApi.current?.flyTo(la, lo, opts.zoom);
      const qs = window.location.search;
      window.history.replaceState(window.history.state, "", placePath(la, lo) + qs);
      scrollRef.current?.scrollTo({ top: 0 });
      load(la, lo);
    },
    [load],
  );

  const onShare = useCallback(async () => {
    const url = window.location.origin + window.location.pathname;
    const title = state.place ? `${state.place.name} · Here Happened` : "Here Happened";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setToast("Couldn’t share. Copy the address bar instead.");
    }
  }, [state.place]);

  const locate = () => {
    if (!("geolocation" in navigator)) return setToast("This browser can’t share your location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        pick(p.coords.latitude, p.coords.longitude, { fly: true, zoom: 13 });
      },
      () => {
        setLocating(false);
        setToast("Location is off. Search or tap the map instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  // Phone sheet: drag the handle (pointer), or tap / Enter / Space / screen-reader activate it (click).
  const onHandleDown = (e: React.PointerEvent) => {
    dragged.current = false;
    dragStart.current = { y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dy) > 4) setDrag(dy);
  };
  const onHandleUp = (e: React.PointerEvent) => {
    const s = dragStart.current;
    dragStart.current = null;
    const dy = s ? e.clientY - s.y : 0;
    setDrag(null);
    if (Math.abs(dy) < 6) return; // a tap: the click handler toggles
    dragged.current = true;
    if (dy < -40) setExpanded(true);
    else if (dy > 40) setExpanded(false);
  };
  const onHandleClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setExpanded((x) => !x);
  };

  // Phone: keyboard focus moving into the collapsed sheet opens it, so focus never lands off-screen.
  const onSheetFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (phone && !expanded && e.target.matches(":focus-visible")) setExpanded(true);
  };

  const closeToday = useCallback(() => {
    setTodayOpen(false);
    todayBtn.current?.focus();
  }, []);

  // One polite announcement per load, outside the aria-busy story so screen readers hear it.
  const n = state.timeline?.length ?? 0;
  const where = state.place?.name ?? "This spot";
  const announce =
    state.status === "loading"
      ? "Reading the record…"
      : state.status === "done"
        ? n > 0
          ? `${where}: ${n} ${n === 1 ? "record" : "records"}`
          : `${where}: nothing on record yet`
        : "";

  const sheetStyle: React.CSSProperties | undefined =
    phone && drag !== null
      ? {
          transform: `translateY(calc(${expanded ? "0px" : `var(--hh-sheet-h) - ${PEEK}px`} + ${drag}px))`,
          transition: "none",
        }
      : undefined;

  const loading = state.status === "loading";

  return (
    <div className="hh-app" data-phone={phone || undefined}>
      <MapCanvas
        apiRef={mapApi}
        point={point}
        loading={loading}
        onPick={(lat, lng) => {
          setTodayOpen(false);
          setExpanded(false);
          pick(lat, lng);
        }}
        padding={phone ? { left: 0, bottom: PEEK } : { left: PANEL_W, bottom: 0 }}
      />

      <div className="hh-side">
        <header className="hh-top">
          <Wordmark />
          <SearchBox
            onPick={(h) => {
              setExpanded(false);
              pick(h.lat, h.lng, { fly: true, zoom: 12 });
            }}
          />
        </header>

        <section
          className="hh-panel"
          data-expanded={expanded || undefined}
          style={sheetStyle}
          aria-label={state.place ? `History of ${state.place.name}` : "Place history"}
        >
          <button
            type="button"
            className="hh-handle"
            aria-expanded={expanded}
            aria-label={expanded ? "Show more map" : "Read the full story"}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={() => (setDrag(null), (dragStart.current = null))}
            onClick={onHandleClick}
          >
            <span className="hh-handle-bar" aria-hidden />
          </button>
          <p className="sr-only" role="status" aria-live="polite">
            {announce}
          </p>
          <div className="hh-panel-scroll" ref={scrollRef} onFocus={onSheetFocus}>
            {offline && (
              <p className="hh-notice hh-notice-offline" role="status">
                You&rsquo;re offline. The map and stories need a connection.
              </p>
            )}
            <StoryPanel
              state={state}
              scrollRoot={scrollRef}
              onPick={(lat, lng) => {
                setExpanded(false);
                pick(lat, lng, { fly: true, zoom: 12 });
              }}
              onRetry={() => point && load(point.lat, point.lng)}
              onWiden={() => mapApi.current?.zoomBy(-3)}
              onShare={onShare}
            />
            <footer className="hh-colophon">
              <p>
                Here Happened quotes open sources and links every line back to them. Map data © OpenStreetMap contributors, tiles by
                OpenFreeMap.
              </p>
            </footer>
          </div>
        </section>
      </div>

      <div className="hh-tools" role="group" aria-label="Map tools">
        <button
          ref={todayBtn}
          type="button"
          className="hh-tool hh-tool-label"
          aria-label="On this day"
          aria-expanded={todayOpen}
          onClick={() => setTodayOpen((x) => !x)}
        >
          <CalendarDays size={18} aria-hidden />
          <span>On this day</span>
        </button>
        <button
          type="button"
          className="hh-tool"
          aria-label="Find my location"
          onClick={locate}
          data-busy={locating || undefined}
          aria-busy={locating || undefined}
        >
          <LocateFixed size={18} aria-hidden />
        </button>
        <div className="hh-zoom">
          <button type="button" className="hh-tool" aria-label="Zoom in" onClick={() => mapApi.current?.zoomBy(1)}>
            <Plus size={18} aria-hidden />
          </button>
          <button type="button" className="hh-tool" aria-label="Zoom out" onClick={() => mapApi.current?.zoomBy(-1)}>
            <Minus size={18} aria-hidden />
          </button>
        </div>
      </div>

      {todayOpen && (
        <div className="hh-today-slot">
          <TodayPanel
            onPick={({ lat, lng }) => {
              setTodayOpen(false);
              setExpanded(false);
              pick(lat, lng, { fly: true, zoom: 11 });
            }}
            onClose={closeToday}
          />
        </div>
      )}

      <div className="hh-toast" role="status" aria-live="polite" data-show={toast ? true : undefined}>
        {toast}
      </div>
    </div>
  );
}

export default Explorer;
