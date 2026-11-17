import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Explorer } from "@/components/explorer/explorer";
import { parsePlaceKey, placeKey, placePath } from "@/lib/contract";
import { SITE_URL, absoluteUrl } from "@/lib/featured";
import { formatCoords, getStory, leadEntry, trimTo } from "@/lib/story-server";

/** A place page is rebuilt at most once a day; the story cache sits behind it. */
export const revalidate = 86400;

/** No places are prebuilt at deploy time; each one renders on first visit, then is cached (ISR). */
export function generateStaticParams(): { coords: string }[] {
  return [];
}

type Props = { params: Promise<{ coords: string }> };

async function resolve(params: Props["params"]) {
  const { coords } = await params;
  const point = parsePlaceKey(coords);
  if (!point) notFound();
  const key = placeKey(point.lat, point.lng);
  let raw = coords;
  try {
    raw = decodeURIComponent(coords);
  } catch {
    // keep the raw segment; parsePlaceKey already accepted it
  }
  return { ...point, key, canonical: raw === key };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lat, lng } = await resolve(params);
  const story = await getStory(lat, lng);
  const path = placePath(lat, lng);
  const url = absoluteUrl(path);

  const name = story?.place.name && story.place.name !== "Somewhere" ? story.place.name : formatCoords(lat, lng);
  const title = `${name}: what happened here`;

  const parts: string[] = [];
  if (story?.coverage.note) parts.push(story.coverage.note.trim());
  const lead = story ? leadEntry(story) : null;
  if (lead) parts.push(`${lead.dateLabel}: ${lead.text.trim()}`);
  const description = trimTo(
    parts.join(" ") ||
      `The real, sourced history of ${story?.place.context ? `${name}, ${story.place.context}` : name}, from the deep past to today.`,
    155,
  );

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Here Happened",
      title,
      description,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    other: {
      "geo.position": `${lat};${lng}`,
      ICBM: `${lat}, ${lng}`,
      ...(story?.place.name ? { "geo.placename": story.place.name } : {}),
    },
  };
}

export default async function PlacePage({ params }: Props) {
  const { lat, lng, canonical } = await resolve(params);
  if (!canonical) permanentRedirect(placePath(lat, lng));
  const story = await getStory(lat, lng);
  return <Explorer initial={{ lat, lng }} initialStory={story} />;
}
