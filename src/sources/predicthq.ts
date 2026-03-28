import type { EventProvider } from "@/sources/types";
import type { EventCard, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText, formatDate } from "@/helpers";

const token = process.env.PREDICTHQ_TOKEN;

const predicthqProvider: EventProvider = {
  name: "predicthq",
  enabled: !!token,
  async search(query, location) {
    if (!token) return [];
    try {
      const params = new URLSearchParams({
        q: query,
        category: "conferences",
        limit: "20",
        sort: "rank",
      });
      if (location) params.set("place.scope", location);

      const res = await fetch(
        `https://api.predicthq.com/v1/events/?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!res.ok) {
        console.warn(`[predicthq] HTTP ${res.status}`);
        return [];
      }

      const json = await res.json();
      const results = json.results || [];

      return results.map((e: any) => {
        const labelText = [e.category, ...(e.labels || [])].filter(Boolean).join(" ");

        return {
          id: `phq-${e.id}`,
          title: e.title || "Untitled",
          date: formatDate(e.start || ""),
          location: e.geo?.address || e.place_hierarchies?.[0]?.at(-1) || "Unknown",
          format: inferFormat(e.title || ""),
          price: "unknown" as PriceType,
          topics: extractTopicsFromText(labelText + " " + (e.title || "")),
          attendeeProfile: "General audience",
          source: "predicthq" as const,
          url: undefined,
        } satisfies Partial<EventCard>;
      });
    } catch (err) {
      console.error("[predicthq] Failed:", err instanceof Error ? err.message : err);
      return [];
    }
  },
};

export default predicthqProvider;
