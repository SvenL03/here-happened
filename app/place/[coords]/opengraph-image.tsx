import { ImageResponse } from "next/og";
import { parsePlaceKey } from "@/lib/contract";
import { absoluteUrl } from "@/lib/featured";
import { C, OG_SIZE, Wordmark, WorldMap, loadBrandFonts } from "@/lib/og-kit";
import { dateStrip, formatCoords, getStory } from "@/lib/story-server";
import brand from "@/lib/brand";

export const runtime = "nodejs";
export const revalidate = 86400;
export const alt = "Here Happened: the sourced history of this place";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Width of the text column in px (1072 inner − 404 map − 56 gap, minus a little air). */
const COL_W = 596;
/** Rough advance widths for Newsreader in em, with a safety margin; good enough to pick a size that fits. */
function measureEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/[mwMW]/.test(ch)) w += 0.88;
    else if (/[A-Z]/.test(ch)) w += 0.7;
    else if (/[0-9]/.test(ch)) w += 0.6;
    else if (/[iljtfr.,:;'’!|-]/.test(ch)) w += 0.32;
    else if (ch === " ") w += 0.25;
    else w += 0.55;
  }
  return w * 1.08;
}

function nameSize(name: string): number {
  const words = name.split(/\s+/);
  const oneLine = COL_W / measureEm(name);
  let twoLines = 0;
  if (words.length > 1) {
    // best split into two lines
    let best = Infinity;
    for (let i = 1; i < words.length; i++) {
      best = Math.min(best, Math.max(measureEm(words.slice(0, i).join(" ")), measureEm(words.slice(i).join(" "))));
    }
    twoLines = COL_W / best;
  }
  return Math.round(Math.max(44, Math.min(112, Math.max(oneLine, Math.min(twoLines, 96)))));
}

function stripSize(dates: string[]): number {
  const gaps = Math.max(0, dates.length - 1) * 39;
  return Math.round(Math.max(24, Math.min(40, (COL_W - gaps) / measureEm(dates.join("")))));
}

export default async function Image({ params }: { params: Promise<{ coords: string }> }) {
  const { coords } = await params;
  const point = parsePlaceKey(coords) ?? { lat: 0, lng: 0 };
  const story = await getStory(point.lat, point.lng);

  const coordText = formatCoords(point.lat, point.lng);
  const rawName = story?.place.name && story.place.name !== "Somewhere" ? story.place.name : coordText;
  const name = rawName.length > 48 ? `${rawName.slice(0, 46).trim()}…` : rawName;
  const context = story?.place.context ?? "";
  let dates = story ? dateStrip(story, 5) : [];
  if (dates.join("").length > 24) dates = story ? dateStrip(story, 4) : [];
  const dateSize = stripSize(dates);
  const host = new URL(absoluteUrl("/")).host;

  const fonts = await loadBrandFonts(
    [name, context, dates.join(""), coordText, brand.wordmark, "On the record", "What happened here", "World · equirectangular", "Land: Natural Earth", "The sourced history of this spot", host].join(""),
  );

  const mapW = 404;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: C.paper,
          color: C.ink,
          padding: "52px 64px 44px",
          fontFamily: brand.fonts.ui,
        }}
      >
        {/* top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Wordmark size={20} />
          <div style={{ display: "flex", fontSize: 20, color: C.inkSoft, letterSpacing: 1 }}>{coordText}</div>
        </div>

        {/* body */}
        <div style={{ display: "flex", flex: 1, marginTop: 36, gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                fontFamily: brand.fonts.display,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 30,
                color: C.accent,
                marginBottom: 10,
              }}
            >
              What happened here
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: brand.fonts.display,
                fontWeight: 500,
                fontSize: nameSize(name),
                lineHeight: 1.02,
                letterSpacing: -1.5,
                color: C.ink,
              }}
            >
              {name}
            </div>
            {context ? (
              <div style={{ display: "flex", fontSize: 26, color: C.inkSoft, marginTop: 18, lineHeight: 1.3 }}>{context}</div>
            ) : null}

            {dates.length >= 2 ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: C.inkSoft,
                    marginBottom: 10,
                  }}
                >
                  On the record
                </div>
                <div style={{ display: "flex", alignItems: "center", fontFamily: brand.fonts.display, fontWeight: 500, fontSize: dateSize, color: C.ink }}>
                  {dates.map((d, i) => (
                    <div key={d} style={{ display: "flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {i > 0 ? (
                        <div style={{ width: 7, height: 7, borderRadius: 99, background: C.accent, margin: "2px 16px 0" }} />
                      ) : null}
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* map plate */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: mapW }}>
            <div style={{ display: "flex", border: `1.5px solid ${C.ink}`, padding: 6, background: C.paper }}>
              <WorldMap width={mapW - 15} pins={[{ lat: point.lat, lng: point.lng, primary: true }]} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                color: C.inkSoft,
                marginTop: 10,
                letterSpacing: 1,
              }}
            >
              <div style={{ display: "flex" }}>World · equirectangular</div>
              <div style={{ display: "flex" }}>Land: Natural Earth</div>
            </div>
          </div>
        </div>

        {/* bottom rule */}
        <div style={{ display: "flex", height: 1.5, background: C.ink, marginTop: 28 }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 18, color: C.inkSoft }}>
          <div style={{ display: "flex" }}>The sourced history of this spot</div>
          <div style={{ display: "flex", color: C.ink, fontWeight: 700 }}>{host}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
