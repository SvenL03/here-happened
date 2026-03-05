"use client";

import { useState, useCallback, useEffect } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { MapPin, Locate, Compass, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { researchLocation, researchTodayInHistory } from "@/app/actions/research";
import type { ResearchResult, TodayEvent } from "@/lib/types";
import { FactsPanel } from "@/components/ui/facts-panel";
import { TodayPanel } from "@/components/ui/today-panel";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

type Mode = "explore" | "on-this-day";

interface SelectedLocation {
  lat: number;
  lng: number;
}

function getTodayFormatted() {
  const now = new Date();
  return now.toLocaleString("en-US", { month: "long", day: "numeric" });
}

// Renders inside <Map> to programmatically pan the map
function MapPanner({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && target) {
      map.panTo(target);
    }
  }, [map, target]);
  return null;
}

// Fits map bounds to show all today's events (runs once after load)
function MapFitter({ events, ready }: { events: TodayEvent[]; ready: boolean }) {
  const map = useMap();
  const [fitted, setFitted] = useState(false);
  useEffect(() => {
    if (!map || !ready || events.length === 0 || fitted) return;
    setFitted(true);
    if (events.length === 1) {
      map.panTo({ lat: events[0].lat, lng: events[0].lng });
      map.setZoom(6);
      return;
    }
    const lats = events.map((e) => e.lat);
    const lngs = events.map((e) => e.lng);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      80
    );
  }, [map, events, ready, fitted]);
  return null;
}

export function MapView() {
  const [mode, setMode] = useState<Mode>("explore");

  // Explore mode state
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // On This Day mode state
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayPanelOpen, setTodayPanelOpen] = useState(false);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [todayFetched, setTodayFetched] = useState(false);

  // Fetch today's events when switching to on-this-day mode (once)
  useEffect(() => {
    if (mode !== "on-this-day" || todayFetched) return;
    setTodayFetched(true);
    setTodayLoading(true);
    setError(null);
    researchTodayInHistory()
      .then((events) => {
        setTodayEvents(events);
        if (events.length > 0) {
          setActiveEventIndex(0);
          setPanTarget({ lat: events[0].lat, lng: events[0].lng });
          setTodayPanelOpen(true);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        setTodayLoading(false);
      });
  }, [mode, todayFetched]);

  // When active card changes, pan map to that event
  const handleActiveChange = useCallback((index: number) => {
    setActiveEventIndex(index);
    const event = todayEvents[index];
    if (event) setPanTarget({ lat: event.lat, lng: event.lng });
  }, [todayEvents]);

  // Explore mode: fetch facts for clicked location
  const fetchFacts = useCallback(async (location: SelectedLocation) => {
    setSelected(location);
    setLoading(true);
    setError(null);
    setPanelOpen(false);
    try {
      const data = await researchLocation(location.lat, location.lng);
      setResult(data);
      setPanelOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (mode !== "explore") return;
      const lat = e.detail?.latLng?.lat;
      const lng = e.detail?.latLng?.lng;
      if (lat != null && lng != null) {
        fetchFacts({ lat, lng });
      }
    },
    [fetchFacts, mode]
  );

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mode === "explore") {
          fetchFacts({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => setError("Could not get your location. Check permissions.")
    );
  }, [fetchFacts, mode]);

  const switchMode = useCallback((newMode: Mode) => {
    setMode(newMode);
    setError(null);
    if (newMode === "explore") {
      setTodayPanelOpen(false);
    } else {
      setPanelOpen(false);
    }
  }, []);

  const isLoading = loading || todayLoading;

  return (
    <div className="relative w-full h-dvh">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={{ lat: 20, lng: 0 }}
          defaultZoom={2}
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          colorScheme="DARK"
          mapId="here-happened-map"
          className="w-full h-full"
        >
          <MapPanner target={panTarget} />
          <MapFitter events={todayEvents} ready={mode === "on-this-day" && !todayLoading} />

          {/* Explore mode: single selected pin */}
          {mode === "explore" && selected && (
            <AdvancedMarker position={selected}>
              <MapPin
                className="text-amber-400 drop-shadow-lg animate-bounce"
                size={36}
                fill="currentColor"
              />
            </AdvancedMarker>
          )}

          {/* On This Day mode: pins for all events */}
          {mode === "on-this-day" && todayEvents.map((event, i) => (
            <AdvancedMarker
              key={i}
              position={{ lat: event.lat, lng: event.lng }}
              onClick={() => handleActiveChange(i)}
            >
              {i === activeEventIndex ? (
                <MapPin
                  className="text-amber-400 drop-shadow-lg"
                  size={36}
                  fill="currentColor"
                />
              ) : (
                <MapPin
                  className="text-zinc-400 drop-shadow"
                  size={24}
                  fill="currentColor"
                />
              )}
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        {/* Mode toggle */}
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl p-1 flex shadow-lg backdrop-blur-sm">
          <button
            onClick={() => switchMode("explore")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === "explore"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Compass size={12} />
            Explore
          </button>
          <button
            onClick={() => switchMode("on-this-day")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === "on-this-day"
                ? "bg-amber-500 text-black"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Calendar size={12} />
            On This Day
          </button>
        </div>

        {/* Locate me (explore mode only) */}
        {mode === "explore" && (
          <Button
            size="icon"
            variant="secondary"
            onClick={handleMyLocation}
            className="bg-zinc-900/90 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white shadow-lg"
            title="Use my location"
          >
            <Locate size={18} />
          </Button>
        )}
      </div>

      {/* Tap hint (explore mode only, before any selection) */}
      {mode === "explore" && !selected && !loading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-zinc-900/90 border border-zinc-800 text-zinc-300 text-sm px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg whitespace-nowrap">
            Tap anywhere to discover history
          </div>
        </div>
      )}

      {/* On This Day loading hint */}
      {mode === "on-this-day" && todayLoading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-zinc-900/90 border border-zinc-800 text-zinc-300 text-sm px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg whitespace-nowrap">
            Finding what happened on {getTodayFormatted()}…
          </div>
        </div>
      )}

      {isLoading && <LoadingOverlay />}

      {error && (
        <div className="absolute bottom-8 left-4 right-4 z-10">
          <div className="bg-red-950/90 border border-red-900 text-red-200 text-sm px-4 py-3 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        </div>
      )}

      {/* Explore mode panel */}
      <FactsPanel
        result={result}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        lat={selected?.lat}
        lng={selected?.lng}
      />

      {/* On This Day panel */}
      <TodayPanel
        events={todayEvents}
        open={todayPanelOpen}
        onClose={() => setTodayPanelOpen(false)}
        activeIndex={activeEventIndex}
        onActiveChange={handleActiveChange}
      />
    </div>
  );
}
