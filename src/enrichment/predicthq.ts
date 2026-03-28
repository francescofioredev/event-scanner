import type { EventCard } from "@/types";

export interface EnrichmentData {
  phqRank?: number;       // 0–100, event significance score
  phqAttendance?: number; // predicted attendance
}

const token = process.env.PREDICTHQ_TOKEN;

export const predicthqEnrichmentEnabled = !!token;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Queries PredictHQ with the same search terms and returns an enrichment map
 * keyed by normalized event title. The aggregator uses this to attach rank and
 * attendance signals to matching events before computing fit scores.
 */
export async function fetchEnrichmentMap(
  query: string,
  location?: string
): Promise<Map<string, EnrichmentData>> {
  const map = new Map<string, EnrichmentData>();
  if (!token) return map;

  try {
    const params = new URLSearchParams({ q: query, limit: "50" });
    if (location) params.set("place.scope", location);

    const res = await fetch(`https://api.predicthq.com/v1/events/?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[predicthq enrichment] HTTP ${res.status}`);
      return map;
    }

    const json = await res.json();
    for (const e of json.results ?? []) {
      const key = normalizeTitle(e.title ?? "");
      if (key) {
        map.set(key, {
          phqRank: e.rank ?? undefined,
          phqAttendance: e.phq_attendance ?? undefined,
        });
      }
    }
  } catch (err) {
    console.error("[predicthq enrichment] Failed:", err instanceof Error ? err.message : err);
  }

  return map;
}

/**
 * Looks up enrichment data for an event by normalized title.
 */
export function getEnrichment(
  event: Partial<EventCard>,
  map: Map<string, EnrichmentData>
): EnrichmentData {
  const key = normalizeTitle(event.title ?? "");
  return map.get(key) ?? {};
}
