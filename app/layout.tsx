import type { Metadata, Viewport } from "next";
import { Newsreader, Overpass } from "next/font/google";
import { preconnect } from "react-dom";
import { SITE_URL } from "@/lib/featured";
import "./globals.css";

const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const ui = Overpass({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Here Happened: the history of any place on Earth",
    template: "%s · Here Happened",
  },
  description:
    "Tap any spot on Earth and read what happened there, through time. Every line is quoted from a real source you can open.",
  applicationName: "Here Happened",
  openGraph: {
    type: "website",
    siteName: "Here Happened",
    title: "Here Happened: the history of any place on Earth",
    description: "Tap any spot on Earth and read what happened there, through time. Every line is quoted from a real source.",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Here Happened" },
  // Previews and local builds stay out of search results.
  ...(process.env.VERCEL_ENV !== "production" ? { robots: { index: false } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F1EC" },
    { media: "(prefers-color-scheme: dark)", color: "#121518" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The map style, tiles and glyphs all come from OpenFreeMap (CORS fetches): open the connection early.
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
