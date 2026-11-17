/**
 * On This Day, from Wikipedia's "selected anniversaries" feed.
 * Rule zero applies: the event text is Wikipedia's, verbatim; the place is the
 * coordinates of a page the event links to (from the feed, or looked up on that
 * same page). Events with no located page are dropped, never guessed.
 */

export const WIKI_UA = "HereHappened/2.0 (https://here-happened-nu.vercel.app; history map)";
const HEADERS = { "User-Agent": WIKI_UA, "Api-User-Agent": WIKI_UA, Accept: "application/json" };
const REVALIDATE = 21600;

export interface TodayItem {
  year: number;
  text: string; // verbatim from the feed
  title: string; // the located page the pin goes to
  url: string;
  description?: string; // that page's short description
  lat: number;
  lng: number;
}

export interface TodayResult {
  month: number;
  day: number;
  items: TodayItem[];
  dropped: number; // events with no located page
  source: { name: string; url: string };
}

interface FeedPage {
  title: string;
  titles?: { normalized?: string; canonical?: string };
  description?: string;
  coordinates?: { lat: number; lon: number };
  content_urls?: { desktop?: { page?: string } };
}

interface FeedEvent {
  text: string;
  year: number;
  pages?: FeedPage[];
}

export function validDate(m: number, d: number): boolean {
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1) return false;
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= days;
}

const SPECIFIC =
  /\b(battle|siege|fire|wildfire|hoard|fort|fortress|flight|crash|accident|massacre|disaster|earthquake|eruption|bombing|attack|treaty|theat(?:re|er)|cathedral|church|temple|mosque|castle|palace|monument|building|bridge|stadium|airport|museum|pipeline|mine|dam|tower|station|square|park|ship|wreck)\b|\b\d{3,4}\b/i;
const BROAD =
  /\b(country|sovereign|province|state in|state of|region|continent|monarchy|empire|kingdom|republic|ocean|marginal sea|arm of the|county of|federal|confederation)\b/i;

function score(p: { description?: string }, index: number): number {
  const d = p.description ?? "";
  let s = 0;
  if (SPECIFIC.test(d)) s += 3;
  if (BROAD.test(d)) s -= 3;
  return s - index * 0.01; // earlier links win ties: they are usually the subject
}

function pageTitle(p: FeedPage): string {
  return p.titles?.normalized ?? p.title.replace(/_/g, " ");
}

function pageUrl(p: FeedPage): string {
  return p.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`;
}

/** Primary coordinates for up to 50 titles at a time, from the same Wikipedia pages. */
async function lookupCoordinates(titles: string[]): Promise<Map<string, { lat: number; lon: number }>> {
  const out = new Map<string, { lat: number; lon: number }>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      prop: "coordinates",
      coprimary: "primary",
      format: "json",
      formatversion: "2",
      redirects: "1",
      origin: "*",
      titles: batch.join("|"),
    }).toString();
    try {
      const res = await fetch(url, { headers: HEADERS, next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: {
          pages?: { title: string; coordinates?: { lat: number; lon: number; globe?: string }[] }[];
          redirects?: { from: string; to: string }[];
          normalized?: { from: string; to: string }[];
        };
      };
      const back = new Map<string, string[]>();
      for (const r of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
        back.set(r.to, [...(back.get(r.to) ?? []), r.from, ...(back.get(r.from) ?? [])]);
      }
      for (const p of data.query?.pages ?? []) {
        const c = p.coordinates?.[0];
        if (!c || (c.globe && c.globe !== "earth")) continue;
        out.set(p.title, { lat: c.lat, lon: c.lon });
        for (const alias of back.get(p.title) ?? []) out.set(alias, { lat: c.lat, lon: c.lon });
      }
    } catch {
      // a failed lookup only means those events are dropped
    }
  }
  return out;
}

export async function getOnThisDay(month: number, day: number): Promise<TodayResult> {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const feedUrl = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`;
  const res = await fetch(feedUrl, { headers: HEADERS, next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikipedia feed ${res.status}`);
  const data = (await res.json()) as { selected?: FeedEvent[] };
  const events = (data.selected ?? []).filter((e) => typeof e.year === "number" && e.text);

  // Events where the feed carries no coordinates for any linked page: look those pages up.
  const missing = new Set<string>();
  for (const e of events) {
    const pages = e.pages ?? [];
    if (!pages.some((p) => p.coordinates)) for (const p of pages) missing.add(pageTitle(p));
  }
  const looked = missing.size ? await lookupCoordinates([...missing]) : new Map();

  const items: TodayItem[] = [];
  let dropped = 0;
  for (const e of events) {
    const located = (e.pages ?? [])
      .map((p, index) => {
        const c = p.coordinates ?? looked.get(pageTitle(p));
        return c && Number.isFinite(c.lat) && Number.isFinite(c.lon) ? { p, c, index } : null;
      })
      .filter((x): x is { p: FeedPage; c: { lat: number; lon: number }; index: number } => x !== null)
      .sort((a, b) => score(b.p, b.index) - score(a.p, a.index));
    const best = located[0];
    if (!best) {
      dropped++;
      continue;
    }
    items.push({
      year: e.year,
      text: e.text.trim(),
      title: pageTitle(best.p),
      url: pageUrl(best.p),
      description: best.p.description,
      lat: best.c.lat,
      lng: best.c.lon,
    });
  }
  items.sort((a, b) => b.year - a.year);

  return {
    month,
    day,
    items,
    dropped,
    source: {
      name: "Wikipedia: selected anniversaries",
      url: `https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries/${new Date(Date.UTC(2000, month - 1, day)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })}_${day}`,
    },
  };
}
