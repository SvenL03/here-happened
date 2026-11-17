import { ImageResponse } from "next/og";
import { FEATURED, absoluteUrl } from "@/lib/featured";
import { C, OG_SIZE, Wordmark, WorldMap, loadBrandFonts, pinOffset } from "@/lib/og-kit";
import brand from "@/lib/brand";

export const runtime = "nodejs";
export const alt = "Here Happened: tap any spot on Earth and see its real, sourced history";
export const size = OG_SIZE;
export const contentType = "image/png";

const LABELLED = new Set(["Colosseum", "Machu Picchu", "Nan Madol", "Cedarville", "Angkor Wat", "Great Zimbabwe"]);

export default async function Image() {
  const host = new URL(absoluteUrl("/")).host;
  const line = "Tap any spot on Earth. See what really happened there, with the source for every line.";
  const labels = FEATURED.filter((p) => LABELLED.has(p.name));
  const fonts = await loadBrandFonts([brand.wordmark, brand.tagline, line, host, ...labels.map((l) => l.name)].join(""));

  const mapW = 1200;
  const north = 64;
  const south = -56;
  const mapH = Math.round((mapW * (north - south)) / 360);

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
          fontFamily: brand.fonts.ui,
          position: "relative",
        }}
      >
        {/* map plate, full bleed at the bottom */}
        <div style={{ position: "absolute", left: 0, bottom: 0, width: mapW, height: mapH, display: "flex" }}>
          <WorldMap width={mapW} north={north} south={south} pins={FEATURED.map((p) => ({ lat: p.lat, lng: p.lng }))} />
          {labels.map((p) => {
            const o = pinOffset(p.lat, p.lng, mapW, north);
            const right = p.lng > 120;
            return (
              <div
                key={p.name}
                style={{
                  position: "absolute",
                  top: o.top - 11,
                  ...(right ? { right: mapW - o.left + 10 } : { left: o.left + 10 }),
                  display: "flex",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color: C.ink,
                  background: "rgba(242,241,236,0.82)",
                  padding: "2px 6px",
                }}
              >
                {p.name}
              </div>
            );
          })}
        </div>

        {/* paper header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "40px 64px 0",
            height: 630 - mapH,
            background: C.paper,
            borderBottom: `1.5px solid ${C.ink}`,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Wordmark size={18} />
            <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: C.ink }}>{host}</div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: brand.fonts.display,
              fontWeight: 500,
              fontSize: 64,
              letterSpacing: -1.2,
              lineHeight: 1.05,
              marginTop: 26,
              whiteSpace: "nowrap",
            }}
          >
            {brand.tagline}
          </div>
          <div style={{ display: "flex", fontSize: 23, color: C.inkSoft, marginTop: 12 }}>{line}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
