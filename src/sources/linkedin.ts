import type { EventProvider } from "@/sources/types";
import type { EventCard, EventFormat, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText, formatDate } from "@/helpers";

const liAt = process.env.LINKEDIN_LI_AT;

const linkedinProvider: EventProvider = {
  name: "linkedin",
  enabled: !!liAt,
  async search(query, _location) {
    if (!liAt) return [];
    try {
      const params = new URLSearchParams({
        keywords: query,
        start: "0",
        count: "20",
      });

      const res = await fetch(
        `https://www.linkedin.com/voyager/api/voyagerEventsV2/events?${params}`,
        {
          headers: {
            Cookie: `li_at=${liAt}`,
            "X-RestLi-Protocol-Version": "2.0.0",
            "X-Li-Lang": "en_US",
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!res.ok) {
        console.warn(`[linkedin] HTTP ${res.status}`);
        return [];
      }

      const json = await res.json();
      const elements = json.elements || [];

      return elements.map((e: any) => {
        const urnId = (e.entityUrn || "").replace("urn:li:event:", "");
        const eventType: string = e.eventType || "IN_PERSON";
        let format: EventFormat;
        if (eventType === "ONLINE") format = "webinar";
        else format = inferFormat(e.title || "");

        const startMs = e.startTime;
        const dateStr = startMs ? formatDate(new Date(startMs).toISOString()) : "TBD";

        return {
          id: `li-${urnId}`,
          title: e.title || "Untitled",
          date: dateStr,
          location: e.locationInfo?.location || (eventType === "ONLINE" ? "Online" : "Unknown"),
          format,
          price: "unknown" as PriceType,
          topics: extractTopicsFromText(e.title || ""),
          attendeeProfile: "Professional network",
          source: "linkedin" as const,
          url: e.vanityUrl ? `https://www.linkedin.com/events/${e.vanityUrl}` : undefined,
        } satisfies Partial<EventCard>;
      });
    } catch (err) {
      console.error("[linkedin] Failed:", err instanceof Error ? err.message : err);
      return [];
    }
  },
};

export default linkedinProvider;
