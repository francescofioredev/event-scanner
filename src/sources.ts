import type { EventCard, EventSource, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText, computeFitScore, formatDate } from "@/helpers";

// ─── Source: Eventbrite ─────────────────────────────────────────────────────────
// NOTE: The /v3/events/search/ endpoint was deprecated in 2019 and shut down in 2020.
// Eventbrite no longer offers a public event discovery API.
// This function is kept as a placeholder for future alternative sources (e.g. PredictHQ).

export async function searchEventbrite(_query: string, _location?: string): Promise<Partial<EventCard>[]> {
  console.log("[Source:Eventbrite] Skipped — search API was deprecated by Eventbrite in 2020. No public discovery endpoint available.");
  return [];
}

// ─── Source: Luma ───────────────────────────────────────────────────────────────

export async function searchLuma(query: string): Promise<Partial<EventCard>[]> {
  try {
    const params = new URLSearchParams({ pagination_limit: "10", query });
    const res = await fetch(`https://api.lu.ma/discover/get-paginated-events?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.log(`[Source:Luma] HTTP ${res.status}`);
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
        source: "luma" as EventSource,
        url: e.url ? `https://lu.ma/${e.url}` : undefined,
      };
    });
  } catch (err) {
    console.error("[Source:Luma] Failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Aggregator ─────────────────────────────────────────────────────────────────

export async function findLiveEvents(query: string, location?: string): Promise<{ events: EventCard[]; sources: Record<string, number> }> {
  const results = await Promise.allSettled([
    searchEventbrite(query, location),
    searchLuma(query),
  ]);

  const allPartials: Partial<EventCard>[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allPartials.push(...r.value);
  }

  const sources: Record<string, number> = {};
  const events: EventCard[] = allPartials.map((partial) => {
    const { fitScore, fitReason } = computeFitScore(partial, query);
    const source = partial.source || "mock";
    sources[source] = (sources[source] || 0) + 1;

    return {
      id: partial.id || `live-${Math.random().toString(36).slice(2, 8)}`,
      title: partial.title || "Untitled",
      date: partial.date || "TBD",
      location: partial.location || "Unknown",
      format: partial.format || "conference",
      price: partial.price || "free",
      priceAmount: partial.priceAmount,
      currency: partial.currency,
      topics: partial.topics || [],
      fitScore,
      fitReason,
      attendeeProfile: partial.attendeeProfile || "General audience",
      source,
      url: partial.url,
    };
  });

  return { events, sources };
}
