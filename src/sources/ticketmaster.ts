import type { EventProvider } from "@/sources/types";
import type { EventCard, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText, formatDate } from "@/helpers";

const apiKey = process.env.TICKETMASTER_API_KEY;

const ticketmasterProvider: EventProvider = {
  name: "ticketmaster",
  enabled: !!apiKey,
  async search(query, location) {
    if (!apiKey) return [];
    try {
      const params = new URLSearchParams({
        apikey: apiKey,
        keyword: query,
        size: "20",
        sort: "date,asc",
      });
      if (location) params.set("city", location);

      const res = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) {
        console.warn(`[ticketmaster] HTTP ${res.status}`);
        return [];
      }

      const json = await res.json();
      const items = json._embedded?.events || [];

      return items.map((e: any) => {
        const venue = e._embedded?.venues?.[0];
        const priceRanges = e.priceRanges;
        const price: PriceType = priceRanges?.length ? "paid" : "free";
        const genreText = (e.classifications || [])
          .flatMap((c: any) => [c.genre?.name, c.subGenre?.name])
          .filter(Boolean)
          .join(" ");

        return {
          id: `tm-${e.id}`,
          title: e.name || "Untitled",
          date: formatDate(e.dates?.start?.dateTime || e.dates?.start?.localDate || ""),
          location: [venue?.name, venue?.city?.name].filter(Boolean).join(", ") || "Unknown",
          format: inferFormat(e.name || ""),
          price,
          priceAmount: priceRanges?.[0]?.min ?? undefined,
          currency: priceRanges?.[0]?.currency ?? undefined,
          topics: extractTopicsFromText(genreText + " " + (e.name || "")),
          attendeeProfile: "General audience",
          source: "ticketmaster" as const,
          url: e.url,
        } satisfies Partial<EventCard>;
      });
    } catch (err) {
      console.error("[ticketmaster] Failed:", err instanceof Error ? err.message : err);
      return [];
    }
  },
};

export default ticketmasterProvider;
