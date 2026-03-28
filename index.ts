import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";
import { MOCK_EVENTS } from "@/mock-data";
import { filterByQuery } from "@/helpers";
import { findLiveEvents } from "@/sources";
import { getUserProfile, updateUserProfile } from "@/user-profile";
import rawEventDetails from "@/data/mock-event-details.json";
import type { EventDetail } from "@/types";

const MOCK_EVENT_DETAILS: EventDetail[] = rawEventDetails as EventDetail[];

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

// Step 3: Event detail — per-event deep-dive with score breakdown
server.tool(
  {
    name: "get-event-detail",
    description:
      "Get full details for a specific event: description, agenda, perks, logistics, and a per-dimension fit score breakdown. Use when the user asks to know more about a specific event.",
    schema: z.object({
      id: z.string().describe("The event ID (e.g. 'evt-001'). Shown on each event card."),
    }),
    annotations: { readOnlyHint: true },
    widget: {
      name: "event-detail",
      invoking: "Loading event details...",
      invoked: "Event details ready",
    },
  },
  async ({ id }) => {
    const detail = MOCK_EVENT_DETAILS.find((e) => e.id === id);

    if (!detail) {
      return { content: [{ type: "text", text: `Event "${id}" not found. Use get-events to list available events.` }] };
    }

    return widget({
      props: { event: detail },
      output: text(
        `Here are the full details for "${detail.title}" on ${detail.date} in ${detail.location}. Fit score: ${detail.fitScore}/100. Venue: ${detail.logistics.venue}. Duration: ${detail.logistics.duration}.`
      ),
    });
  }
);

// Step 3: User profile — read
server.tool(
  {
    name: "get-user-profile",
    description:
      "Returns the current user preference profile: interests, location, budget, format preferences, and goal. Use this to show the user their current profile or before computing personalized fit scores.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    const profile = getUserProfile();
    return {
      content: [
        {
          type: "text",
          text: [
            `**Your current profile:**`,
            `- **Goal**: ${profile.goal}`,
            `- **Interests**: ${profile.interests.join(", ")}`,
            `- **Location**: ${profile.location}`,
            `- **Budget**: ${profile.budget}`,
            `- **Preferred formats**: ${profile.formatPreferences.join(", ")}`,
          ].join("\n"),
        },
      ],
    };
  }
);

// Step 3: User profile — update
server.tool(
  {
    name: "update-user-profile",
    description:
      "Save user preference fields. Only pass fields that should change — unset fields keep their current value. Use after the user shares their interests, location, budget, or event format preferences.",
    schema: z.object({
      interests: z
        .array(z.string())
        .optional()
        .describe("Topics the user cares about, e.g. ['AI', 'Startups', 'React']"),
      location: z.string().optional().describe("User's city or region, e.g. 'Turin, Italy'"),
      budget: z
        .enum(["free", "under50", "under200", "any"])
        .optional()
        .describe("Max budget for events: free, under50 (€50), under200 (€200), any"),
      formatPreferences: z
        .array(z.enum(["conference", "meetup", "hackathon", "workshop", "webinar"]))
        .optional()
        .describe("Event formats the user prefers"),
      goal: z.string().optional().describe("What the user wants to get out of events, in their own words"),
    }),
  },
  async (updates) => {
    const profile = updateUserProfile(updates);
    const changed = Object.keys(updates).filter((k) => updates[k as keyof typeof updates] !== undefined);

    return {
      content: [
        {
          type: "text",
          text:
            changed.length > 0
              ? `Profile updated: ${changed.join(", ")}. New goal: "${profile.goal}". Interests: ${profile.interests.join(", ")}.`
              : "No changes applied — profile unchanged.",
        },
      ],
    };
  }
);

server.listen().then(() => {
  console.log("Event Scanner server running");
});
