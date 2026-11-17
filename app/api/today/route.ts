import { getOnThisDay, validDate } from "@/lib/today";

/** GET /api/today?m=MM&d=DD — the client sends its own local date. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const now = new Date();
  const m = Number(sp.get("m") ?? now.getUTCMonth() + 1);
  const d = Number(sp.get("d") ?? now.getUTCDate());
  if (!validDate(m, d)) {
    return Response.json({ error: "Use ?m=1-12&d=1-31 with a real date." }, { status: 400 });
  }
  try {
    const result = await getOnThisDay(m, d);
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("[api/today]", err);
    return Response.json(
      { error: "Wikipedia's On This Day feed is not answering right now." },
      { status: 502, headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  }
}
