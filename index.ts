import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";

const server = new MCPServer({
  name: "event-scanner",
  title: "Event Scanner",
  version: "1.0.0",
  description: "Personal event intelligence agent — discover, score, and act on events that matter to you.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

// ─── Types ──────────────────────────────────────────────────────────────────────

type EventFormat = "conference" | "meetup" | "hackathon" | "workshop" | "webinar";
type PriceType = "free" | "paid";
type EventSource = "eventbrite" | "luma" | "mock";

interface EventCard {
  id: string;
  title: string;
  date: string;
  location: string;
  format: EventFormat;
  price: PriceType;
  priceAmount?: number;
  currency?: string;
  topics: string[];
  fitScore: number;
  fitReason: string;
  attendeeProfile: string;
  source: EventSource;
  url?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function inferFormat(text: string): EventFormat {
  const t = text.toLowerCase();
  if (t.includes("hackathon") || t.includes("hack")) return "hackathon";
  if (t.includes("workshop") || t.includes("bootcamp") || t.includes("hands-on")) return "workshop";
  if (t.includes("webinar") || t.includes("online talk") || t.includes("livestream")) return "webinar";
  if (t.includes("meetup") || t.includes("meet-up") || t.includes("networking") || t.includes("dinner") || t.includes("social")) return "meetup";
  return "conference";
}

function extractTopicsFromText(text: string): string[] {
  const topicKeywords = [
    "AI", "Machine Learning", "LLM", "Agents", "Deep Learning", "NLP",
    "React", "JavaScript", "TypeScript", "Frontend", "Backend", "Full Stack",
    "Python", "Rust", "Go", "DevOps", "Cloud", "AWS", "Kubernetes",
    "Blockchain", "Web3", "Crypto", "DeFi",
    "Design", "UX", "UI", "Product", "Figma",
    "Startups", "Fundraising", "VC", "Networking", "Entrepreneurship",
    "Data Science", "Analytics", "Big Data",
    "Security", "Cybersecurity", "Privacy",
    "Mobile", "iOS", "Android", "Flutter", "React Native",
    "Open Source", "Linux", "Community",
    "SaaS", "B2B", "Marketing", "Growth", "Sales",
    "Healthcare", "Fintech", "EdTech", "Climate",
  ];
  const lower = text.toLowerCase();
  return topicKeywords.filter((kw) => lower.includes(kw.toLowerCase())).slice(0, 5);
}

function computeFitScore(event: Partial<EventCard>, query: string): { fitScore: number; fitReason: string } {
  let score = 50;
  const reasons: string[] = [];

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const titleLower = (event.title || "").toLowerCase();
  const topicsLower = (event.topics || []).map((t) => t.toLowerCase());
  const locationLower = (event.location || "").toLowerCase();

  // Query term matching
  const matchedTerms = queryTerms.filter(
    (t) => titleLower.includes(t) || topicsLower.some((topic) => topic.includes(t)) || locationLower.includes(t)
  );
  if (matchedTerms.length > 0) {
    score += matchedTerms.length * 12;
    reasons.push(`Matches: ${matchedTerms.join(", ")}`);
  }

  // Topic richness bonus
  if ((event.topics || []).length >= 3) {
    score += 5;
  }

  // Price bonus
  if (event.price === "free") {
    score += 5;
    reasons.push("free entry");
  }

  score = Math.min(100, Math.max(0, score));
  const reasonText = reasons.length > 0 ? reasons.join(". ") + "." : "General event match based on search criteria.";

  return { fitScore: score, fitReason: reasonText };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Source: Eventbrite ─────────────────────────────────────────────────────────
// NOTE: The /v3/events/search/ endpoint was deprecated in 2019 and shut down in 2020.
// Eventbrite no longer offers a public event discovery API.
// This function is kept as a placeholder for future alternative sources (e.g. PredictHQ).

async function searchEventbrite(_query: string, _location?: string): Promise<Partial<EventCard>[]> {
  console.log("[Source:Eventbrite] Skipped — search API was deprecated by Eventbrite in 2020. No public discovery endpoint available.");
  return [];
}

// ─── Source: Luma ───────────────────────────────────────────────────────────────

async function searchLuma(query: string): Promise<Partial<EventCard>[]> {
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

async function findLiveEvents(query: string, location?: string): Promise<{ events: EventCard[]; sources: Record<string, number> }> {
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

// ─── Mock Event Data ────────────────────────────────────────────────────────────

const MOCK_EVENTS: EventCard[] = [
  {
    id: "evt-001",
    title: "AI Summit Turin",
    date: "Apr 12, 2026",
    location: "Turin, Italy",
    format: "conference",
    price: "free",
    topics: ["AI", "Agents", "LLM", "Machine Learning"],
    fitScore: 87,
    fitReason: "Strong match on AI/agents topics and free entry fits any budget.",
    attendeeProfile: "AI researchers, developers, startup founders",
    source: "mock",
  },
  {
    id: "evt-002",
    title: "Founders Dinner Turin",
    date: "Apr 18, 2026",
    location: "Turin, Italy",
    format: "meetup",
    price: "paid",
    priceAmount: 20,
    currency: "EUR",
    topics: ["Networking", "Startups", "Co-founder", "Fundraising"],
    fitScore: 82,
    fitReason: "Intimate networking format ideal for finding collaborators and co-founders.",
    attendeeProfile: "Early-stage founders, angel investors",
    source: "mock",
  },
  {
    id: "evt-003",
    title: "AI for Healthcare Webinar",
    date: "Apr 28, 2026",
    location: "Online",
    format: "webinar",
    price: "free",
    topics: ["AI", "Healthcare", "Ethics", "LLM"],
    fitScore: 71,
    fitReason: "Relevant AI content in an accessible online format with no cost or travel.",
    attendeeProfile: "Healthcare professionals, AI practitioners",
    source: "mock",
  },
  {
    id: "evt-004",
    title: "WebDev Hackathon 2026",
    date: "Apr 20–21, 2026",
    location: "Remote",
    format: "hackathon",
    price: "free",
    topics: ["JavaScript", "React", "Next.js", "APIs"],
    fitScore: 65,
    fitReason: "Hands-on building experience, though focus is frontend rather than AI.",
    attendeeProfile: "Frontend and full-stack developers",
    source: "mock",
  },
  {
    id: "evt-005",
    title: "React Advanced Milan",
    date: "May 3, 2026",
    location: "Milan, Italy",
    format: "conference",
    price: "paid",
    priceAmount: 150,
    currency: "EUR",
    topics: ["React", "Frontend", "TypeScript", "Performance"],
    fitScore: 58,
    fitReason: "High-quality technical content but price and frontend focus reduce fit.",
    attendeeProfile: "Senior frontend engineers",
    source: "mock",
  },
  {
    id: "evt-006",
    title: "UX Design Workshop",
    date: "Apr 15, 2026",
    location: "Milan, Italy",
    format: "workshop",
    price: "paid",
    priceAmount: 45,
    currency: "EUR",
    topics: ["Design", "UX", "Figma", "Product"],
    fitScore: 52,
    fitReason: "Useful design skills but not closely aligned with core technical interests.",
    attendeeProfile: "Product designers, UX researchers",
    source: "mock",
  },
  {
    id: "evt-007",
    title: "Open Source Community Day",
    date: "May 8, 2026",
    location: "Turin, Italy",
    format: "meetup",
    price: "free",
    topics: ["Open Source", "Community", "DevTools", "Collaboration"],
    fitScore: 48,
    fitReason: "Local and free, but niche open-source focus may not match current goals.",
    attendeeProfile: "Open source contributors, developers",
    source: "mock",
  },
  {
    id: "evt-008",
    title: "B2B SaaS Product Conference",
    date: "Apr 25, 2026",
    location: "Milan, Italy",
    format: "conference",
    price: "paid",
    priceAmount: 89,
    currency: "EUR",
    topics: ["Product", "SaaS", "B2B", "Strategy", "GTM"],
    fitScore: 34,
    fitReason: "B2B SaaS focus is a poor match — topic and audience don't align with profile.",
    attendeeProfile: "Product managers, B2B SaaS founders",
    source: "mock",
  },
];

// ─── Simple keyword filter ──────────────────────────────────────────────────────

function filterByQuery(events: EventCard[], query: string): EventCard[] {
  const q = query.toLowerCase();
  return events.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.topics.some((t) => t.toLowerCase().includes(q)) ||
      e.location.toLowerCase().includes(q) ||
      e.format.toLowerCase().includes(q) ||
      e.attendeeProfile.toLowerCase().includes(q)
  );
}

// ─── Tools ──────────────────────────────────────────────────────────────────────

// Step 1: Mock data — offline/demo mode
server.tool(
  {
    name: "get-events",
    description:
      "Browse pre-loaded demo events with fit scores. Good for offline testing. Use 'find-events' for live search.",
    schema: z.object({
      query: z
        .string()
        .optional()
        .describe("Keyword filter — topic, location, format. Leave empty for all demo events."),
    }),
    annotations: { readOnlyHint: true },
    widget: {
      name: "event-feed",
      invoking: "Loading demo events...",
      invoked: "Demo events ready",
    },
  },
  async ({ query }) => {
    const events = query ? filterByQuery(MOCK_EVENTS, query) : MOCK_EVENTS;
    const label = query ? `"${query}"` : "all events";

    return widget({
      props: { query: query ?? "", events, sources: { mock: events.length } },
      output: text(
        events.length > 0
          ? `Found ${events.length} demo event${events.length === 1 ? "" : "s"} matching ${label}. Scores range from ${Math.min(...events.map((e) => e.fitScore))} to ${Math.max(...events.map((e) => e.fitScore))}.`
          : `No demo events matching ${label}. Try a different keyword or browse all events.`
      ),
    });
  }
);

// Step 2: Live search — real event sources
server.tool(
  {
    name: "find-events",
    description:
      "Search Eventbrite, Luma, and other sources for real events. Use natural language — e.g. 'AI events in Turin', 'free React workshops near Milan', 'startup networking events'.",
    schema: z.object({
      query: z
        .string()
        .describe("What kind of events to find — topic, location, format, date, or any natural phrase."),
      location: z
        .string()
        .optional()
        .describe("City or region to focus the search — e.g. 'Turin', 'Milan', 'London'. Helps Eventbrite narrow results."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    widget: {
      name: "event-feed",
      invoking: "Searching Eventbrite, Luma...",
      invoked: "Live events loaded",
    },
  },
  async ({ query, location }) => {
    const { events, sources } = await findLiveEvents(query, location);

    // Sort by fit score descending
    events.sort((a, b) => b.fitScore - a.fitScore);

    const sourceSummary = Object.entries(sources)
      .map(([s, n]) => `${n} from ${s}`)
      .join(", ");

    return widget({
      props: { query, events, sources },
      output: text(
        events.length > 0
          ? `Found ${events.length} live event${events.length === 1 ? "" : "s"} for "${query}". Sources: ${sourceSummary}. Top fit score: ${events[0].fitScore}.`
          : `No events found for "${query}" on live sources. Try different keywords, or use get-events for demo data.`
      ),
    });
  }
);

server.listen().then(() => {
  console.log("Event Scanner server running");
});
