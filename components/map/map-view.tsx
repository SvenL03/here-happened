"use client";

import { useState, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { MapPin, Locate, Compass, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { researchLocation, researchLocationOnThisDay } from "@/app/actions/research";
import type { ResearchResult } from "@/lib/types";
import { FactsPanel } from "@/components/ui/facts-panel";
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

export function MapView() {
  const [mode, setMode] = useState<Mode>("explore");
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const fetchFacts = useCallback(async (location: SelectedLocation, currentMode: Mode) => {
    setSelected(location);
    setLoading(true);
    setError(null);
    setPanelOpen(false);

    try {
      const data = currentMode === "on-this-day"
        ? await researchLocationOnThisDay(location.lat, location.lng)
        : await researchLocation(location.lat, location.lng);
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
      const lat = e.detail?.latLng?.lat;
      const lng = e.detail?.latLng?.lng;
      if (lat != null && lng != null) {
        fetchFacts({ lat, lng }, mode);
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
        fetchFacts({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }, mode);
      },
      () => setError("Could not get your location. Check permissions.")
    );
  }, [fetchFacts, mode]);

  const hintText = mode === "on-this-day"
    ? `Tap anywhere to see what happened on ${getTodayFormatted()}`
    : "Tap anywhere to discover history";

  return (
    <div className="relative w-full h-dvh">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={{ lat: 40.7128, lng: -74.006 }}
          defaultZoom={4}
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          colorScheme="DARK"
          mapId="here-happened-map"
          className="w-full h-full"
        >
          {selected && (
            <AdvancedMarker position={selected}>
              <MapPin
                className="text-amber-400 drop-shadow-lg animate-bounce"
                size={36}
                fill="currentColor"
              />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        {/* Mode toggle */}
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl p-1 flex shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setMode("explore")}
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
            onClick={() => setMode("on-this-day")}
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

        {/* Locate me */}
        <Button
          size="icon"
          variant="secondary"
          onClick={handleMyLocation}
          className="bg-zinc-900/90 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white shadow-lg"
          title="Use my location"
        >
          <Locate size={18} />
        </Button>
      </div>

      {/* Tap hint */}
      {!selected && !loading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-zinc-900/90 border border-zinc-800 text-zinc-300 text-sm px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg whitespace-nowrap">
            {hintText}
          </div>
        </div>
      )}

      {loading && <LoadingOverlay />}

      {error && (
        <div className="absolute bottom-8 left-4 right-4 z-10">
          <div className="bg-red-950/90 border border-red-900 text-red-200 text-sm px-4 py-3 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        </div>
      )}

      <FactsPanel
        result={result}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        lat={selected?.lat}
        lng={selected?.lng}
      />
    </div>
  );
}
