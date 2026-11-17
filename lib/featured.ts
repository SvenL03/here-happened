/**
 * Featured places: a varied set used by the sitemap and the home share image.
 * Coordinates are the primary coordinates of each place's English Wikipedia page
 * (looked up 2026-11-16), snapped by placePath to the 3-decimal share key.
 */
import { placePath } from "@/lib/contract";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://here-happened-nu.vercel.app").replace(/\/+$/, "");

export interface FeaturedPlace {
  name: string;
  context: string;
  lat: number;
  lng: number;
}

export const FEATURED: FeaturedPlace[] = [
  { name: "Colosseum", context: "Rome, Italy", lat: 41.8903, lng: 12.4922 },
  { name: "Cedarville", context: "Greene County, Ohio, United States", lat: 39.7514, lng: -83.8111 },
  { name: "Nan Madol", context: "Pohnpei, Micronesia", lat: 6.8419, lng: 158.3322 },
  { name: "Wolframs-Eschenbach", context: "Middle Franconia, Bavaria, Germany", lat: 49.2264, lng: 10.7253 },
  { name: "Machu Picchu", context: "Cusco Region, Peru", lat: -13.1633, lng: -72.5456 },
  { name: "Great Zimbabwe", context: "Masvingo Province, Zimbabwe", lat: -20.2667, lng: 30.9333 },
  { name: "Angkor Wat", context: "Siem Reap, Cambodia", lat: 13.4125, lng: 103.8667 },
  { name: "Petra", context: "Ma'an Governorate, Jordan", lat: 30.3222, lng: 35.4517 },
  { name: "Hiroshima Peace Memorial", context: "Hiroshima, Japan", lat: 34.3956, lng: 132.4536 },
  { name: "Timbuktu", context: "Tombouctou Region, Mali", lat: 16.7758, lng: -3.0094 },
  { name: "Ahu Tongariki", context: "Easter Island, Chile", lat: -27.1258, lng: -109.2769 },
  { name: "Independence Hall", context: "Philadelphia, Pennsylvania, United States", lat: 39.9489, lng: -75.15 },
];

export function featuredPath(p: FeaturedPlace): string {
  return placePath(p.lat, p.lng);
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
