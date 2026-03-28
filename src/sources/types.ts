import type { EventCard, EventSource } from "@/types";

export interface EventProvider {
  name: EventSource;
  enabled: boolean;
  search(query: string, location?: string): Promise<Partial<EventCard>[]>;
}

export function createStubProvider(
  name: EventSource,
  data: Partial<EventCard>[]
): EventProvider {
  return {
    name,
    enabled: true,
    async search(query) {
      if (!query) return data;
      const q = query.toLowerCase();
      return data.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.topics?.some((t) => t.toLowerCase().includes(q)) ||
          e.location?.toLowerCase().includes(q)
      );
    },
  };
}
