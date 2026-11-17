"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker as MLMarker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { brand } from "@/lib/brand";

export interface MapApi {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  zoomBy: (delta: number) => void;
}

type Palette = (typeof brand)["light"] | (typeof brand)["dark"];

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Rewrites positron's paint into the survey-atlas palette. */
function restyle(style: StyleSpecification, p: Palette, dark: boolean): StyleSpecification {
  const waterInk = dark ? "#5E8794" : "#4F7482";
  const labelSoft = dark ? "#8E959B" : "#6A6F74";
  const layers = style.layers.map((l) => {
    const id = l.id;
    const paint: Record<string, unknown> = { ...(("paint" in l && l.paint) || {}) };
    const set = (k: string, v: unknown) => {
      paint[k] = v;
    };
    if (l.type === "background") set("background-color", p.land);
    else if (id === "water") set("fill-color", p.water);
    else if (id === "waterway") set("line-color", p.water);
    else if (id === "park" || id === "landcover_wood") {
      set("fill-color", p.park);
      if (id === "landcover_wood") set("fill-opacity", 0.6);
    } else if (id.startsWith("landcover_ice") || id.startsWith("landcover_glacier")) set("fill-color", dark ? "#1E2428" : "#F7F7F3");
    else if (id === "landuse_residential") {
      set("fill-color", p.paperDeep);
      set("fill-opacity", 0.55);
    } else if (id === "building") {
      set("fill-color", p.paperDeep);
      set("fill-outline-color", p.boundary);
    } else if (id.startsWith("aeroway") && l.type === "fill") set("fill-color", p.paperDeep);
    else if (l.type === "line" && /casing/.test(id)) set("line-color", dark ? "#0E1114" : "#CBC5B5");
    else if (l.type === "line" && /^(highway|tunnel|aeroway|road)/.test(id)) set("line-color", p.road);
    else if (l.type === "line" && /^railway/.test(id)) set("line-color", p.boundary);
    else if (l.type === "line" && /^boundary/.test(id)) set("line-color", p.boundary);
    else if (l.type === "symbol") {
      const isWater = /water/.test(id);
      const major = /label_(country|state|city)/.test(id);
      set("text-color", isWater ? waterInk : major ? p.ink : labelSoft);
      set("text-halo-color", p.land);
      set("text-halo-width", 1.2);
      if ("text-halo-blur" in paint) set("text-halo-blur", 0);
      if (/label_(town|village|other)|airport|highway-name/.test(id)) {
        return { ...l, paint, minzoom: Math.max((l as { minzoom?: number }).minzoom ?? 0, 6) } as typeof l;
      }
      if (/label_city$/.test(id)) {
        return { ...l, paint, minzoom: Math.max((l as { minzoom?: number }).minzoom ?? 0, 4) } as typeof l;
      }
    } else if (l.type === "fill" && "fill-color" in paint) set("fill-color", p.paperDeep);
    return { ...l, paint } as typeof l;
  });
  // Quieter road shields: hide them, the atlas reads by names.
  const filtered = layers.filter((l) => !/shield/.test(l.id));
  return { ...style, layers: filtered, projection: { type: "globe" } } as StyleSpecification;
}

function pinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "hh-pin";
  el.setAttribute("aria-hidden", "true");
  // A trig-point mark: the survey symbol for a measured station.
  el.innerHTML =
    '<span class="hh-pin-ring"></span><svg viewBox="0 0 32 30" width="30" height="28"><path d="M16 2 L30 27 L2 27 Z" class="hh-pin-tri"/><circle cx="16" cy="18.5" r="3.2" class="hh-pin-dot"/></svg>';
  return el;
}

export function MapCanvas({
  apiRef,
  point,
  loading,
  onPick,
  padding,
}: {
  apiRef: React.MutableRefObject<MapApi | null>;
  point: { lat: number; lng: number } | null;
  loading: boolean;
  onPick: (lat: number, lng: number) => void;
  padding: { left: number; bottom: number };
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<MLMarker | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const initialPoint = useRef(point);
  const paddingRef = useRef(padding);

  useEffect(() => {
    onPickRef.current = onPick;
    paddingRef.current = padding;
  });

  useEffect(() => {
    let cancelled = false;
    let mq: MediaQueryList | null = null;
    let onScheme: (() => void) | null = null;
    (async () => {
      try {
        // Dev-only: background tabs (headless review panes) never fire rAF; ?raf=1 swaps in a timer so the map still draws.
        if (process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("raf")) {
          window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
          window.cancelAnimationFrame = (id) => window.clearTimeout(id);
        }
        const ml = await import("maplibre-gl");
        // MapLibre 6 finds its worker relative to its own module URL, which webpack rewrites; point it at the emitted asset.
        try {
          ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
        } catch {}
        mlRef.current = ml;
        const raw = (await fetch(STYLE_URL).then((r) => r.json())) as StyleSpecification;
        if (cancelled || !box.current) return;
        mq = window.matchMedia("(prefers-color-scheme: dark)");
        const styleFor = () => restyle(raw, mq!.matches ? brand.dark : brand.light, mq!.matches);
        const p0 = initialPoint.current;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const map = new ml.Map({
          container: box.current,
          style: styleFor(),
          center: p0 ? [p0.lng, p0.lat] : [-30, 28],
          zoom: p0 ? 11 : window.innerWidth <= 640 ? 1.15 : 2.25,
          attributionControl: { compact: true },
          fadeDuration: reduce ? 0 : 300,
          maxPitch: 0,
          dragRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        map.on("error", (e) => console.warn("[hh-map]", e.error?.message));
        map.setPadding({ left: paddingRef.current.left, bottom: paddingRef.current.bottom, top: 0, right: 0 });
        mapRef.current = map;
        if (process.env.NODE_ENV !== "production") (window as unknown as { __hhMap?: MLMap }).__hhMap = map;
        map.on("style.load", () => {
          map.setProjection({ type: "globe" });
          try {
            map.setSky({ "atmosphere-blend": 0 } as never);
          } catch {}
        });
        map.on("load", () => {
          if (!cancelled) setReady(true);
        });
        map.on("click", (e) => onPickRef.current(e.lngLat.lat, e.lngLat.lng));
        // Keyboard path: arrow keys pan (MapLibre), Enter reads the history at the centre of the visible map.
        const canvas = map.getCanvas();
        canvas.setAttribute(
          "aria-label",
          "Map. Click or tap anywhere to read its history. With a keyboard, pan with the arrow keys and press Enter to read the centre.",
        );
        canvas.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const c = map.getCenter();
          onPickRef.current(c.lat, c.lng);
        });
        onScheme = () => map.setStyle(styleFor(), { diff: true });
        mq.addEventListener("change", onScheme);
        apiRef.current = {
          flyTo: (lat, lng, zoom) => {
            const z = zoom ?? Math.max(map.getZoom(), 10.5);
            if (reduce) map.jumpTo({ center: [lng, lat], zoom: z });
            else map.flyTo({ center: [lng, lat], zoom: z, speed: 1.4, curve: 1.5, essential: true });
          },
          zoomBy: (d) => map.easeTo({ zoom: map.getZoom() + d, duration: reduce ? 0 : 300 }),
        };
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (mq && onScheme) mq.removeEventListener("change", onScheme);
      apiRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [apiRef]);

  // Padding follows the panel (side panel on desktop, sheet on phone).
  useEffect(() => {
    mapRef.current?.setPadding({ left: padding.left, bottom: padding.bottom, top: 0, right: 0 });
  }, [padding.left, padding.bottom, ready]);

  // The pin.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new ml.Marker({ element: pinElement(), anchor: "bottom", offset: [0, 4] })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
    } else markerRef.current.setLngLat([point.lng, point.lat]);
    const el = markerRef.current.getElement();
    el.classList.remove("hh-pin-drop");
    void el.offsetWidth;
    el.classList.add("hh-pin-drop");
  }, [point, ready]);

  useEffect(() => {
    markerRef.current?.getElement().classList.toggle("is-loading", loading);
  }, [loading, ready, point]);

  return (
    <div className="hh-map" data-ready={ready || undefined}>
      <div ref={box} className="hh-map-canvas" />
      {failed && (
        <p className="hh-map-failed" role="status">
          The map couldn&rsquo;t load. Search still works.
        </p>
      )}
    </div>
  );
}
