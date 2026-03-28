import type { EventProvider } from "@/sources/types";
import type { EventCard, EventFormat, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText, formatDate } from "@/helpers";

const token = process.env.MEETUP_ACCESS_TOKEN;

const QUERY = `
  query SearchEvents($input: KeywordSearchInput!) {
    keywordSearch(input: $input) {
      edges {
        node {
          result {
            ... on Event {
              id
              title
              eventUrl
              dateTime
              isOnline
              venue { address city country }
              feeSettings { amount currency }
              topics { name }
            }
          }
        }
      }
    }
  }
`;

const meetupProvider: EventProvider = {
  name: "meetup",
  enabled: !!token,
  async search(query, location) {
    if (!token) return [];
    try {
      const variables: any = {
        input: {
          query,
          filter: { source: "EVENTS" },
        },
      };
      if (location) {
        variables.input.filter.customLocation = location;
      }

      const res = await fetch("https://api.meetup.com/gql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: QUERY, variables }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[meetup] HTTP ${res.status}`);
        return [];
      }

      const json = await res.json();
      const edges = json.data?.keywordSearch?.edges || [];

      return edges
        .map((edge: any) => edge?.node?.result)
        .filter((e: any) => e && e.id)
        .map((e: any) => {
          const fee = e.feeSettings;
          const price: PriceType = !fee || fee.amount === 0 ? "free" : "paid";
          const topicNames: string = (e.topics || []).map((t: any) => t.name).join(" ");

          return {
            id: `meetup-${e.id}`,
            title: e.title || "Untitled",
            date: formatDate(e.dateTime || ""),
            location: e.isOnline ? "Online" : [e.venue?.address, e.venue?.city].filter(Boolean).join(", ") || "Unknown",
            format: e.isOnline ? ("webinar" as EventFormat) : inferFormat(e.title || ""),
            price,
            priceAmount: fee?.amount ?? undefined,
            currency: fee?.currency ?? undefined,
            topics: extractTopicsFromText(topicNames + " " + (e.title || "")),
            attendeeProfile: "Meetup community",
            source: "meetup" as const,
            url: e.eventUrl,
          } satisfies Partial<EventCard>;
        });
    } catch (err) {
      console.error("[meetup] Failed:", err instanceof Error ? err.message : err);
      return [];
    }
  },
};

export default meetupProvider;
