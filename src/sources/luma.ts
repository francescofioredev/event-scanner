import type { EventProvider } from "@/sources/types";
import type { EventCard, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText, formatDate } from "@/helpers";

const lumaProvider: EventProvider = {
  name: "luma",
  enabled: true,
  async search(query, location) {
    try {
      // The discover endpoint has no geo filtering — append location to query as a workaround.
      // For proper geo filtering, use the official Luma API (requires LUMA_API_KEY).
      const fullQuery = location ? `${query} ${location}` : query;
      const params = new URLSearchParams({ pagination_limit: "10", query: fullQuery });
      const res = await fetch(`https://api.lu.ma/discover/get-paginated-events?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[luma] HTTP ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.entries || []).map((entry: any, i: number) => {
        const e = entry.event || entry;
        const ticketInfo = entry.ticket_info;
        return {
          id: `luma-${e.api_id || i}`,
          title: e.name || "Untitled Event",
          date: formatDate(e.start_at || ""),
          location: e.geo_address_info?.city_state || e.geo_address_info?.city || (e.meeting_url ? "Online" : "Unknown"),
          format: inferFormat(e.name || ""),
          price: (ticketInfo?.is_free === false ? "paid" : "free") as PriceType,
          topics: extractTopicsFromText(e.name || ""),
          attendeeProfile: "Community members",
          source: "luma" as const,
          url: e.url ? `https://lu.ma/${e.url}` : undefined,
        } satisfies Partial<EventCard>;
      });
    } catch (err) {
      console.error("[luma] Failed:", err instanceof Error ? err.message : err);
      return [];
    }
  },
};

export default lumaProvider;
