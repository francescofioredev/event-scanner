# Event Scanner — Personal Event Intelligence Agent

## Overview
- **What**: An MCP App that acts as a personal event intelligence agent. It discovers events, scores them for semantic fit with the user's goals and preferences, and helps the user register and manage attendance — all through natural conversation.
- **Who**: Professionals (developers, founders, designers) who attend industry events and want AI-curated recommendations instead of manually browsing Eventbrite or Meetup.
- **Why MCP App**: Semantic fit scoring, natural language queries, preference learning, and calendar-aware recommendations are native LLM capabilities that a CRUD web app cannot replicate. The conversation IS the interface.

## Tech Stack
- Framework: mcp-use (TypeScript)
- UI: React widgets via mcp-use/react
- Scaffold: `npx create-mcp-use-app event-scanner --template mcp-apps`
- Dev: `npm run dev` → Inspector at localhost:3000/inspector

## Architecture

### Project Structure
```
event-scanner/
├── index.ts                     # Server: tools + mock data
├── resources/
│   ├── event-feed/
│   │   └── widget.tsx           # Event list widget (Step 1)
│   └── event-detail/
│       └── widget.tsx           # Event detail panel (Step 3)
├── package.json
└── tsconfig.json
```

### State Strategy
- **Server state**: Event array, user profile (goal, preferences), fit scores — all computed/stored in tool handlers
- **Widget state**: UI-only state — nothing stored widget-side that affects data (Step 1 is read-only)

---

## Step 1: Event Feed (display-only)

**Goal**: Render a scrollable list of scored events from mock data. Proves the full stack end-to-end before adding any interactivity.

### Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get-events` | Returns all events (optionally filtered by a natural language query) with pre-computed fit scores | `widget({ component: "event-feed", props: { query, events } })` |

### Widget: `event-feed`

**Props**:
```ts
{
  query: string,             // The search query or "all events"
  events: Array<{
    id: string,
    title: string,
    date: string,            // e.g. "Apr 12, 2026"
    location: string,        // e.g. "Turin, Italy" or "Online"
    format: "conference" | "meetup" | "hackathon" | "workshop" | "webinar",
    price: "free" | "paid",
    priceAmount?: number,
    currency?: string,
    topics: string[],
    fitScore: number,        // 0–100
    fitReason: string,       // 1-sentence explanation
    attendeeProfile: string  // e.g. "Developers & AI researchers"
  }>
}
```

**Renders**: A vertically stacked list of event cards. Each card shows:
- Title (bold, large) + format badge (conference / meetup / hackathon / workshop / webinar)
- Date and location pills
- Topic tags (colored chips)
- Price (Free or €XX)
- Fit score bar (0–100): green ≥70, amber 40–69, red <40 — with a one-line reason below

### Key Patterns
- Mock data: 8 hardcoded events in index.ts
- `useWidgetTheme()` for all colors from day one
- No interactivity in Step 1 — read-only display
- Fit scores are pre-computed in mock data (no LLM call)

### Done When
- [ ] `get-events` returns widget in Inspector with no args
- [ ] `get-events` with `query: "AI"` returns only AI-tagged events
- [ ] All 8 events render with correct layout
- [ ] Light and dark themes both display correctly

---

## Step 2: Active Event Finder (live search)

**Goal**: Search real event sources (Eventbrite, Luma) in real time. The tool fetches, normalizes, scores, and displays live events — not just static mock data.

### New Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `find-events` | Searches Eventbrite and Luma APIs for events matching a query. Normalizes results, computes basic fit scores, and returns them in the same `event-feed` widget. | `widget({ component: "event-feed", props: { query, events, sources } })` |

### Sources

| Source | Method | Auth |
|--------|--------|------|
| **Eventbrite** | REST API v3 (`/events/search/`) | `EVENTBRITE_TOKEN` env var (free tier) |
| **Luma** | Public API (`/discover/get-paginated-events`) | None (public endpoint) |

Each source adapter:
- Has its own `search*()` function
- Returns normalized `EventCard[]`
- Fails silently if the API is unreachable (returns `[]`)
- Respects an 8-second timeout per source
- Sources run in parallel via `Promise.allSettled`

### Fit Scoring (Step 2 — basic)
Without a full user profile, fit scores are computed via keyword matching:
- +15 per query term that matches event title or topics
- +5 for free events
- Base score: 50
- Capped at 0–100

### Widget Changes
- **Adds**: `source` field per card ("eventbrite", "luma", "mock") — rendered as a small colored pill
- **Adds**: `url` field per card — title becomes a clickable link to the original event page
- **Adds**: Source summary header ("3 from Eventbrite, 2 from Luma")
- Existing mock-data `get-events` tool still works (for offline/demo use)

### Done When
- [ ] `find-events` with `query: "AI"` returns real events from at least one live source
- [ ] Events from different sources display correctly with source badges
- [ ] If a source is down or unconfigured, the tool still works (graceful degradation)
- [ ] Event titles link to their original event page
- [ ] Step 1 `get-events` still works with mock data

---

## Step 3: Event Detail Panel + User Profile

**Goal**: Deep-dive per event with full fit score breakdown; persistent user profile.

### New Tools

| Tool | Description |
|------|-------------|
| `get-event-detail` | Returns full event with per-dimension score breakdown (topic, attendees, schedule, budget, size) |
| `get-user-profile` | Returns the current user profile |
| `update-user-profile` | Saves profile fields (interests, location, budget, format preferences) |

### New Widget: `event-detail`
- Triggered by clicking an event card → sends `sendFollowUpMessage("Tell me more about event {id}")`
- Shows: full description, agenda, perks, logistics, fit score breakdown as horizontal bars per dimension
- "Register Interest" CTA button

### Done When
- [ ] Clicking a card sends follow-up and `get-event-detail` returns the detail widget
- [ ] Score breakdown renders per dimension
- [ ] Profile updates persist across tool calls within session

---

## Design Direction

- **Product Type**: Event discovery catalog + intelligence dashboard
- **Visual Style**: Clean, data-dense professional. Cards over tables. Indigo accent for brand elements and fit scores.
- **Accent Color**: `#6366F1` (indigo-500) — fit score bar fill, topic chip backgrounds, CTA buttons
- **Score Colors**:
  - High (≥70): `#22C55E` green / dark: `#4ADE80`
  - Medium (40–69): `#F59E0B` amber / dark: `#FCD34D`
  - Low (<40): `#EF4444` red / dark: `#F87171`
- **Key UI Elements**:
  - Event cards: `borderRadius: 12`, `padding: 16`, border `1px solid` theme border token
  - Format badge: small pill, uppercase, monospace-friendly
  - Topic chips: `borderRadius: 9999`, `padding: 2px 8px`, `fontSize: 11`
  - Fit score: thin progress bar (height 6px) + numeric label
- **Dark Mode**: Required from Step 1 via `useWidgetTheme()`
- **Closest Reference App**: `customer-segmentation` (data cards + filters pattern)
- **Layout**: Single-column list within 400-600px viewport; no horizontal scroll needed

---

## Implementation Notes
- Invoke `/mcp-apps-builder` for ALL tool and widget code (patterns, helpers, state)
- Invoke `/ui-ux-pro-max` for widget styling decisions
- Start with mock data — Eventbrite/Luma API integration is post-MVP scope
- One tool per action — `get-events` is read-only; mutations come in Step 2
- Test each step in Inspector before moving to next
