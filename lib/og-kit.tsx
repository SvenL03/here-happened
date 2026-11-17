/**
 * Shared pieces for the share images (app/opengraph-image.tsx, app/place/[coords]/opengraph-image.tsx):
 * brand fonts from Google Fonts (TTF, subset to the text drawn), and an equirectangular
 * world map built from Natural Earth land (world-atlas land-110m) with d3-geo.
 */
import { geoEquirectangular, geoGraticule, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import brand from "@/lib/brand";

export const OG_SIZE = { width: 1200, height: 630 };
export const C = brand.light;

type FontSpec = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" | "italic" };

const fontMemo = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchGoogleFont(query: string, text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].sort().join("");
  const url = `https://fonts.googleapis.com/css2?family=${query}&text=${encodeURIComponent(chars)}`;
  const memoed = fontMemo.get(url);
  if (memoed) return memoed;
  const p = (async () => {
    try {
      const css = await (await fetch(url, { signal: AbortSignal.timeout(4000) })).text();
      const src = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype|woff)'\)/)?.[1];
      if (!src) return null;
      const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
      return res.ok ? await res.arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  fontMemo.set(url, p);
  p.then((d) => {
    if (!d) fontMemo.delete(url);
  });
  return p;
}

/** Newsreader (display) and Overpass (labels), subset to `text`. Missing fonts are skipped; Satori falls back. */
export async function loadBrandFonts(text: string): Promise<FontSpec[]> {
  const t = `${text} ·—:,.'’0123456789°NSEW`;
  const [display, displayItalic, ui, uiBold] = await Promise.all([
    fetchGoogleFont("Newsreader:opsz,wght@72,500", t),
    fetchGoogleFont("Newsreader:ital,opsz,wght@1,72,400", t),
    fetchGoogleFont("Overpass:wght@400", t),
    fetchGoogleFont("Overpass:wght@700", t.toUpperCase() + t),
  ]);
  const out: FontSpec[] = [];
  if (display) out.push({ name: brand.fonts.display, data: display, weight: 500, style: "normal" });
  if (displayItalic) out.push({ name: brand.fonts.display, data: displayItalic, weight: 400, style: "italic" });
  if (ui) out.push({ name: brand.fonts.ui, data: ui, weight: 400, style: "normal" });
  if (uiBold) out.push({ name: brand.fonts.ui, data: uiBold, weight: 700, style: "normal" });
  return out;
}

/* ---------- world map ---------- */

/** Map space: the whole world at 1000 × 500 (1 unit = 0.36°). Crop with an SVG viewBox. */
const MAP_W = 1000;
const MAP_H = 500;
const projection = geoEquirectangular()
  .scale(MAP_W / (2 * Math.PI))
  .translate([MAP_W / 2, MAP_H / 2]);

let landD: string | null = null;
let gratD: string | null = null;

function landPath(): string {
  if (landD) return landD;
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topo, topo.objects.land);
  landD = geoPath(projection).digits(1)(geo) ?? "";
  return landD;
}

function graticulePath(): string {
  if (gratD) return gratD;
  gratD = geoPath(projection).digits(1)(geoGraticule().step([30, 30])()) ?? "";
  return gratD;
}

export function project(lat: number, lng: number): [number, number] {
  return (projection([lng, lat]) as [number, number]) ?? [MAP_W / 2, MAP_H / 2];
}

export interface MapPin {
  lat: number;
  lng: number;
  label?: string;
  primary?: boolean;
}

/**
 * A world map as inline SVG. `north`/`south` crop the latitudes shown (default 84°N to 58°S:
 * no Antarctica). Width is fixed; height follows the crop.
 */
export function WorldMap({
  width,
  pins,
  north = 84,
  south = -58,
  water = C.water,
  landFill = C.land,
  coast = C.boundary,
  pinColor = C.accent,
}: {
  width: number;
  pins: MapPin[];
  north?: number;
  south?: number;
  water?: string;
  landFill?: string;
  coast?: string;
  pinColor?: string;
}) {
  const y0 = ((90 - north) / 180) * MAP_H;
  const y1 = ((90 - south) / 180) * MAP_H;
  const vbH = y1 - y0;
  const height = Math.round((width * vbH) / MAP_W);
  const k = MAP_W / width; // map units per output pixel
  return (
    <svg width={width} height={height} viewBox={`0 ${y0.toFixed(1)} ${MAP_W} ${vbH.toFixed(1)}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={0} y={y0} width={MAP_W} height={vbH} fill={water} />
      <path d={graticulePath()} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={0.9 * k} />
      <path d={landPath()} fill={landFill} stroke={coast} strokeWidth={0.9 * k} strokeLinejoin="round" />
      {pins.map((p, i) => {
        const [x, y] = project(p.lat, p.lng);
        const r = (p.primary ? 7 : 4.5) * k;
        return (
          <g key={i}>
            {p.primary ? <circle cx={x} cy={y} r={r * 3.2} fill={pinColor} fillOpacity={0.16} /> : null}
            {p.primary ? <circle cx={x} cy={y} r={r * 1.9} fill="none" stroke={pinColor} strokeOpacity={0.55} strokeWidth={1.4 * k} /> : null}
            <circle cx={x} cy={y} r={r} fill={pinColor} stroke="#FFFFFF" strokeWidth={(p.primary ? 2.4 : 1.6) * k} />
          </g>
        );
      })}
    </svg>
  );
}

/** Where a pin lands in output pixels for a WorldMap of this width and crop (for HTML labels over the SVG). */
export function pinOffset(lat: number, lng: number, width: number, north = 84): { left: number; top: number } {
  const [x, y] = project(lat, lng);
  const y0 = ((90 - north) / 180) * MAP_H;
  const s = width / MAP_W;
  return { left: x * s, top: (y - y0) * s };
}

/** The wordmark lockup used on every share image: a small marker-red pin, then the name in spaced caps. */
export function Wordmark({ size = 22, color = C.ink }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.55 }}>
      <div
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: 999,
          background: C.accent,
          border: `${Math.max(2, size * 0.1)}px solid ${C.paper}`,
          boxShadow: `0 0 0 ${Math.max(1, size * 0.06)}px ${C.accent}`,
        }}
      />
      <div
        style={{
          fontFamily: brand.fonts.ui,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: size * 0.16,
          textTransform: "uppercase",
          color,
        }}
      >
        {brand.wordmark}
      </div>
    </div>
  );
}
