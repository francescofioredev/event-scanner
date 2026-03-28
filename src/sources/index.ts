import type { EventCard } from "@/types";
import type { EventProvider } from "@/sources/types";
import { computeFitScore } from "@/helpers";
import lumaProvider from "@/sources/luma";
import meetupProvider from "@/sources/meetup";
import ticketmasterProvider from "@/sources/ticketmaster";
import linkedinProvider from "@/sources/linkedin";
import predicthqProvider from "@/sources/predicthq";
import tickadooProvider from "@/sources/tickadoo";

// ─── Registry ───────────────────────────────────────────────────────────────────
// To add a new provider: import it above and add it to this array.

const providers: EventProvider[] = [
  lumaProvider,
  meetupProvider,
  ticketmasterProvider,
  linkedinProvider,
  predicthqProvider,
  tickadooProvider,
];

// ─── Deduplication ──────────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function countFields(e: Partial<EventCard>): number {
  return Object.values(e).filter((v) => v !== undefined && v !== null && v !== "").length;
}

function deduplicate(events: Partial<EventCard>[]): Partial<EventCard>[] {
  const seen = new Map<string, Partial<EventCard>>();

  for (const event of events) {
    const key = `${normalizeTitle(event.title || "")}|${event.date || ""}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, event);
    } else if (countFields(event) > countFields(existing)) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

// ─── Aggregator ─────────────────────────────────────────────────────────────────

export async function findLiveEvents(
  query: string,
  location?: string
): Promise<{ events: EventCard[]; sources: Record<string, number> }> {
  try {
    return await _findLiveEvents(query, location);
  } catch (err) {
    console.error("[aggregator] Unexpected error:", err instanceof Error ? err.message : err);
    return { events: [], sources: {} };
  }
}

async function _findLiveEvents(
  query: string,
  location?: string
): Promise<{ events: EventCard[]; sources: Record<string, number> }> {
  const active = providers.filter((p) => p.enabled);

  const results = await Promise.allSettled(
    active.map((p) => p.search(query, location))
  );

  const allPartials: Partial<EventCard>[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allPartials.push(...result.value);
    } else {
      console.error(`[${active[i].name}] Rejected:`, result.reason);
    }
  });

  let deduplicated: Partial<EventCard>[];
  try {
    deduplicated = deduplicate(allPartials);
  } catch (err) {
    console.error("[aggregator] Deduplication failed:", err instanceof Error ? err.message : err);
    deduplicated = allPartials;
  }

  const sources: Record<string, number> = {};
  const events: EventCard[] = deduplicated.flatMap((partial) => {
    try {
      const { fitScore, fitReason } = computeFitScore(partial, query);
      const source = partial.source || "mock";
      sources[source] = (sources[source] || 0) + 1;

      return [{
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
      }];
    } catch (err) {
      console.error("[aggregator] Skipping malformed event:", err instanceof Error ? err.message : err);
      return [];
    }
  });

  return { events, sources };
}
