import { MCPServer, text, widget, error, oauthSupabaseProvider } from "mcp-use/server";
import { z } from "zod";
import { MOCK_EVENTS } from "@/mock-data";
import { filterByQuery, buildGoogleCalendarUrl } from "@/helpers";
import { findLiveEvents } from "@/sources";
import { getUserProfile, updateUserProfile, isDefaultProfile } from "@/user-profile";
import { getSavedEvents, saveEvent, unsaveEvent } from "@/supabase";
import rawEventDetails from "@/data/mock-event-details.json";
import { getConsentPageHtml } from "@/oauth-consent";
import type { EventCard, EventDetail } from "@/types";

const MOCK_EVENT_DETAILS: EventDetail[] = rawEventDetails as EventDetail[];

// In-memory cache of events returned by tools (for the save-event lookup)
const eventCache = new Map<string, EventCard>();

function cacheEvents(events: EventCard[]) {
  for (const e of events) eventCache.set(e.id, e);
}

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
  oauth: oauthSupabaseProvider({
    projectId: "zayxaqagtkewyugrcfvm",
    jwtSecret: "1jOcpXK+Rm+HCFoVFlCHHT7yVyFJp5l3h/xqfkiMvc+e6udv37OqQyhOtEmPNqNMqZEOfK+Yi42L8vnxxEYvHQ==",
  }),
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
  async ({ query }, ctx) => {
    const events = query ? filterByQuery(MOCK_EVENTS, query) : MOCK_EVENTS;
    const label = query ? `"${query}"` : "all events";

    cacheEvents(events);

    const profile = await getUserProfile(ctx.auth.accessToken, ctx.auth.user.userId);
    const profileHint = isDefaultProfile(profile)
      ? "\n\nTip: Your profile uses default preferences. For personalized scores, call setup-profile — use what you know about the user to pre-fill their interests, location, and goals."
      : "";

    return widget({
      props: { query: query ?? "", events, sources: { mock: events.length } },
      output: text(
        (events.length > 0
          ? `Found ${events.length} demo event${events.length === 1 ? "" : "s"} matching ${label}. Scores range from ${Math.min(...events.map((e) => e.fitScore))} to ${Math.max(...events.map((e) => e.fitScore))}.`
          : `No demo events matching ${label}. Try a different keyword or browse all events.`) + profileHint
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
        .describe("City or region to focus the search — e.g. 'Turin', 'Milan', 'London'."),
      formats: z
        .array(z.enum(["conference", "meetup", "hackathon", "workshop", "webinar", "festival", "concert", "networking"]))
        .optional()
        .describe("Filter by event format — e.g. ['conference', 'meetup']. Leave empty for all formats."),
      topics: z
        .array(z.string())
        .optional()
        .describe("Filter by topic — e.g. ['AI', 'Fintech']. An event must match at least one topic."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    widget: {
      name: "event-feed",
      invoking: "Searching Eventbrite, Luma...",
      invoked: "Live events loaded",
    },
  },
  async ({ query, location, formats, topics }, ctx) => {
    const { events, sources } = await findLiveEvents(query, { location, formats, topics });

    events.sort((a, b) => b.fitScore - a.fitScore);
    cacheEvents(events);

    const sourceSummary = Object.entries(sources)
      .map(([s, n]) => `${n} from ${s}`)
      .join(", ");

    const profile = await getUserProfile(ctx.auth.accessToken, ctx.auth.user.userId);
    const profileHint = isDefaultProfile(profile)
      ? "\n\nTip: Your profile uses default preferences. For personalized scores, call setup-profile — use what you know about the user to pre-fill their interests, location, and goals."
      : "";

    return widget({
      props: { query, events, sources },
      output: text(
        (events.length > 0
          ? `Found ${events.length} live event${events.length === 1 ? "" : "s"} for "${query}". Sources: ${sourceSummary}. Top fit score: ${events[0].fitScore}.`
          : `No events found for "${query}" on live sources. Try different keywords, or use get-events for demo data.`) + profileHint
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
  async ({ id }, _ctx) => {
    let detail: EventDetail | undefined = MOCK_EVENT_DETAILS.find((e) => e.id === id);

    // Fallback: build detail from cached live event (find-events results)
    if (!detail) {
      const cached = eventCache.get(id);
      if (cached) {
        detail = {
          ...cached,
          description: `${cached.title} — live event sourced from ${cached.source}.${cached.url ? ` Visit the event page for full details.` : ""}`,
          agenda: [],
          perks: [],
          logistics: {
            venue: cached.location,
            duration: "See event page",
            website: cached.url,
          },
          scoreBreakdown: {
            topic: cached.fitScore,
            attendees: cached.fitScore,
            schedule: cached.fitScore,
            budget: cached.fitScore,
            size: cached.fitScore,
          },
        };
      }
    }

    if (!detail) {
      return { content: [{ type: "text", text: `Event "${id}" not found. Use get-events to list available events.` }] };
    }

    cacheEvents([detail]);

    return widget({
      props: { event: detail },
      output: text(
        `Here are the full details for "${detail.title}" on ${detail.date} in ${detail.location}. Fit score: ${detail.fitScore}/100. Venue: ${detail.logistics.venue}. Duration: ${detail.logistics.duration}.`
      ),
    });
  }
);

// Add to Google Calendar
server.tool(
  {
    name: "add-to-calendar",
    description:
      "Generate a Google Calendar link for an event. Returns a URL that opens Google Calendar with the event pre-filled. Use when the user wants to add an event to their calendar.",
    schema: z.object({
      eventId: z.string().describe("The event ID (e.g. 'evt-001' or a Luma event ID)"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ eventId }) => {
    const event = eventCache.get(eventId);
    if (!event) {
      return error(
        `Event "${eventId}" not found in recent results. Please search for the event first using get-events or find-events, then try again.`
      );
    }

    const calendarUrl = buildGoogleCalendarUrl(event);
    return text(
      `Here's your Google Calendar link for "${event.title}" on ${event.date}:\n\n${calendarUrl}\n\nClick to add it to your Google Calendar.`
    );
  }
);

// User profile — read
server.tool(
  {
    name: "get-user-profile",
    description:
      "Returns the current user preference profile: interests, location, budget, format preferences, and goal. Use this to show the user their current profile or before computing personalized fit scores.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async ({}, ctx) => {
    const profile = await getUserProfile(ctx.auth.accessToken, ctx.auth.user.userId);
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

// User profile — update
server.tool(
  {
    name: "update-user-profile",
    description:
      "Save user preference fields. Only pass fields that should change — unset fields keep their current value. Use after the user shares their interests, location, budget, or event format preferences.",
    schema: z.object({
      interests: z
        .preprocess(
          (val) => (typeof val === "string" ? val.split(",").map((s) => s.trim()) : val),
          z.array(z.string())
        )
        .optional()
        .describe("Topics the user cares about, e.g. ['AI', 'Startups', 'React']"),
      location: z.string().optional().describe("User's city or region, e.g. 'Turin, Italy'"),
      budget: z
        .enum(["free", "under50", "under200", "any"])
        .optional()
        .describe("Max budget for events: free, under50 (€50), under200 (€200), any"),
      formatPreferences: z
        .preprocess(
          (val) => (typeof val === "string" ? val.split(",").map((s) => s.trim()) : val),
          z.array(z.enum(["conference", "meetup", "hackathon", "workshop", "webinar"]))
        )
        .optional()
        .describe("Event formats the user prefers"),
      goal: z.string().optional().describe("What the user wants to get out of events, in their own words"),
    }),
  },
  async (updates, ctx) => {
    const profile = await updateUserProfile(ctx.auth.accessToken, ctx.auth.user.userId, updates);
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

// Smart onboarding — AI-assisted profile setup
server.tool(
  {
    name: "setup-profile",
    description:
      "Set up the user's event preference profile. IMPORTANT: Before calling this tool, " +
      "use what you know about the user from your memory, conversation history, and custom " +
      "instructions to suggest values for ALL fields. Fill in as many fields as possible.\n\n" +
      "Guidelines:\n" +
      "- interests: Topics the user has discussed or shown interest in\n" +
      "- location: Where the user lives or works\n" +
      "- budget: students/hobbyists → 'free'/'under50', professionals → 'under200'/'any'\n" +
      "- formatPreferences: remote workers → include 'webinar', social → include 'meetup'\n" +
      "- goal: Summarize what the user wants from events in their own words\n\n" +
      "If you don't know something, set confidence to 'low' and make your best guess.",
    schema: z.object({
      interests: z.array(z.string()).describe("Suggested topics based on what you know about the user"),
      location: z.string().describe("User's city/region based on your knowledge or context"),
      budget: z.enum(["free", "under50", "under200", "any"]).describe("Suggested budget tier"),
      formatPreferences: z
        .array(z.enum(["conference", "meetup", "hackathon", "workshop", "webinar"]))
        .describe("Event formats that suit this user"),
      goal: z.string().describe("What the user wants from events, in natural language"),
      confidence: z
        .enum(["high", "medium", "low"])
        .optional()
        .describe("How confident you are in these suggestions based on your knowledge of the user"),
    }),
  },
  async (suggestions, ctx) => {
    const profile = await updateUserProfile(ctx.auth.accessToken, ctx.auth.user.userId, {
      interests: suggestions.interests,
      location: suggestions.location,
      budget: suggestions.budget,
      formatPreferences: suggestions.formatPreferences,
      goal: suggestions.goal,
    });

    const confidenceNote =
      suggestions.confidence === "low"
        ? " Some suggestions are based on limited information — feel free to update anytime."
        : "";

    return {
      content: [
        {
          type: "text" as const,
          text:
            `Profile set up! Interests: ${profile.interests.join(", ")}. ` +
            `Location: ${profile.location}. Budget: ${profile.budget}. ` +
            `Formats: ${profile.formatPreferences.join(", ")}. ` +
            `Goal: "${profile.goal}".${confidenceNote}`,
        },
      ],
    };
  }
);

// ─── Bookmark tools ─────────────────────────────────────────────────────────────

server.tool(
  {
    name: "save-event",
    description:
      "Bookmark an event for later. Saves the event to your personal collection. Use when the user wants to save, bookmark, or remember a specific event.",
    schema: z.object({
      eventId: z.string().describe("The event ID to save (e.g. 'evt-001' or a Luma event ID)"),
      notes: z.string().optional().describe("Optional personal notes about why this event is interesting"),
    }),
  },
  async ({ eventId, notes }, ctx) => {
    const event = eventCache.get(eventId);
    if (!event) {
      return error(
        `Event "${eventId}" not found in recent results. Please search for the event first using get-events or find-events, then try saving again.`
      );
    }

    await saveEvent(ctx.auth.accessToken, ctx.auth.user.userId, event, notes);
    return text(`Saved "${event.title}" to your bookmarks.${notes ? ` Notes: ${notes}` : ""}`);
  }
);

server.tool(
  {
    name: "get-saved-events",
    description:
      "View your bookmarked events. Shows all events you've previously saved.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
    widget: {
      name: "event-feed",
      invoking: "Loading your saved events...",
      invoked: "Saved events loaded",
    },
  },
  async ({}, ctx) => {
    const saved = await getSavedEvents(ctx.auth.accessToken, ctx.auth.user.userId);
    const events = saved.map((s) => s.eventData);

    cacheEvents(events);

    return widget({
      props: { query: "saved", events, sources: { saved: events.length } },
      output: text(
        events.length > 0
          ? `You have ${events.length} saved event${events.length === 1 ? "" : "s"}.`
          : "You don't have any saved events yet. Use save-event to bookmark events you're interested in."
      ),
    });
  }
);

server.tool(
  {
    name: "unsave-event",
    description:
      "Remove a bookmarked event from your saved collection.",
    schema: z.object({
      eventId: z.string().describe("The event ID to remove from bookmarks"),
    }),
  },
  async ({ eventId }, ctx) => {
    await unsaveEvent(ctx.auth.accessToken, ctx.auth.user.userId, eventId);
    return text(`Event "${eventId}" removed from your saved events.`);
  }
);

// ─── OAuth consent page ─────────────────────────────────────────────────────

server.get("/oauth/consent", (c) => {
  const html = getConsentPageHtml(
    'zayxaqagtkewyugrcfvm',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheXhhcWFndGtld3l1Z3JjZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDczNDksImV4cCI6MjA5MDI4MzM0OX0.q8PIDw5bhMFyU1cyjMhxYW27ZQP3vaD9KqfZ9HasjU8',
  );
  return c.html(html);
});

server.listen().then(() => {
  console.log("Event Scanner server running");
});
