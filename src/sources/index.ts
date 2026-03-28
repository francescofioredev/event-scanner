import type { EventCard } from "@/types";
import type { EventProvider } from "@/sources/types";
import { computeFitScore } from "@/helpers";
import { fetchEnrichmentMap, getEnrichment } from "@/enrichment/predicthq";
import lumaProvider from "@/sources/luma";
import meetupProvider from "@/sources/meetup";
import ticketmasterProvider from "@/sources/ticketmaster";
import linkedinProvider from "@/sources/linkedin";
import tickadooProvider from "@/sources/tickadoo";
import demoProvider from "@/sources/stubs/demo";

// ─── Registry ───────────────────────────────────────────────────────────────────
// To add a new provider: import it above and add it to this array.

const DEMO_MODE = process.env.DEMO === "true";

const providers: EventProvider[] = DEMO_MODE
  ? [demoProvider]
  : [lumaProvider, meetupProvider, ticketmasterProvider, linkedinProvider, tickadooProvider, demoProvider];

// Log provider status at startup
if (DEMO_MODE) {
  console.log("[providers] DEMO mode — only mock data");
} else {
  const enabled = providers.filter((p) => p.enabled).map((p) => p.name);
  const disabled = providers.filter((p) => !p.enabled).map((p) => p.name);
  console.log(`[providers] active: ${enabled.join(", ") || "none"}`);
  if (disabled.length) console.log(`[providers] skipped (no credentials): ${disabled.join(", ")}`);
}

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

export interface FindEventsOptions {
  location?: string;
  formats?: string[];
  topics?: string[];
}

export async function findLiveEvents(
  query: string,
  options: FindEventsOptions = {}
): Promise<{ events: EventCard[]; sources: Record<string, number> }> {
  try {
    return await _findLiveEvents(query, options);
  } catch (err) {
    console.error("[aggregator] Unexpected error:", err instanceof Error ? err.message : err);
    return { events: [], sources: {} };
  }
}

async function _findLiveEvents(
  query: string,
  { location, formats, topics }: FindEventsOptions
): Promise<{ events: EventCard[]; sources: Record<string, number> }> {
  const active = providers.filter((p) => p.enabled);

  // Run provider searches and PredictHQ enrichment fetch in parallel
  const [results, enrichmentMap] = await Promise.all([
    Promise.allSettled(active.map((p) => p.search(query, location))),
    fetchEnrichmentMap(query, location ?? ""),
  ]);

  const allPartials: Partial<EventCard>[] = [];
  results.forEach((result, i) => {
    const name = active[i].name;
    if (result.status === "fulfilled") {
      console.log(`[${name}] ${result.value.length} result(s)`);
      allPartials.push(...result.value);
    } else {
      console.error(`[${name}] Rejected:`, result.reason);
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
      const { fitScore, fitReason } = computeFitScore(partial, query, getEnrichment(partial, enrichmentMap));
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

  const filtered = events.filter((e) => {
    if (formats && formats.length > 0 && !formats.includes(e.format)) return false;
    if (topics && topics.length > 0 && !topics.some((t) => e.topics.map((et) => et.toLowerCase()).includes(t.toLowerCase()))) return false;
    return true;
  });

  return { events: filtered, sources };
}
