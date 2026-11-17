import Link from "next/link";
import brand from "@/lib/brand";

export const metadata = { title: "Not found" };

export default function NotFound() {
  const c = brand.light;
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: c.paper,
        color: c.ink,
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 440, width: "100%" }}>
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            style={{ width: 10, height: 10, borderRadius: 99, background: c.accent, boxShadow: `0 0 0 2px ${c.paper}, 0 0 0 3px ${c.accent}` }}
          />
          {brand.wordmark}
        </p>
        <h1
          style={{
            fontFamily: `var(--font-display, "${brand.fonts.display}"), Georgia, "Times New Roman", serif`,
            fontSize: "clamp(2.25rem, 8vw, 3.25rem)",
            lineHeight: 1.05,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: "28px 0 12px",
          }}
        >
          Nothing is recorded here.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: c.inkSoft, margin: 0 }}>
          This link doesn&rsquo;t point to a place we know. Place links look like{" "}
          <code style={{ background: c.paperDeep, padding: "1px 6px", borderRadius: 4, fontSize: 15 }}>/place/41.890,12.492</code>.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            marginTop: 28,
            padding: "12px 18px",
            borderRadius: 999,
            background: c.accent,
            color: c.accentInk,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Open the map
        </Link>
      </div>
    </main>
  );
}
