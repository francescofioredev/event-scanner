# Event data sources — integration reference

> This document maps each candidate event data source to the `EventCard` interface.  
> Use it to decide which adapters to build and in what order.

```typescript
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
  fitScore: number;       // computed by LLM, not from source
  fitReason: string;      // computed by LLM, not from source
  attendeeProfile: string; // computed by LLM, not from source
  source: EventSource;
  url?: string;
}
```

Fields marked **LLM-derived** (`fitScore`, `fitReason`, `attendeeProfile`) are never populated by the adapter — they are always computed by the orchestration layer after raw data is fetched.

---

## Source index

| # | Source | Type | Auth | Geo coverage | Best for | Priority |
|---|--------|------|------|--------------|----------|----------|
| 1 | **Luma** (lu.ma) | Unofficial REST | API key | Global, strong in EU/US tech | Tech, startup, AI events | ✅ Already done |
| 2 | **Meetup** | GraphQL API | OAuth 2.0 | Global | Community meetups, recurring groups | 🔴 High |
| 3 | **Ticketmaster Discovery** | REST API | API key | Global, strong in EU | Conferences, large events | 🔴 High |
| 4 | **Eventbrite** | REST v3 | OAuth / API token | Global | Mixed: corporate, community, paid | 🟡 Medium |
| 5 | **Partiful** | Unofficial / scrape | None (public) | US-heavy | Social, Gen-Z events | 🟡 Medium |
| 6 | **LinkedIn Events** | Unofficial REST | Session cookie | Global, professional | B2B, professional networking | 🟡 Medium |
| 7 | **Facebook Events** | Graph API v21 | App token | Global | Local community events | 🔴 Low (ToS friction) |
| 8 | **Eventful / Predicthq** | REST API | API key | Global | AI-enriched event intelligence | 🟢 Nice to have |

---

## 1. Luma (lu.ma)

**Status:** already implemented — use as reference adapter.

- **Base URL:** `https://api.lu.ma/public/v1`
- **Auth:** `x-luma-api-key` header
- **Key endpoint:** `GET /event/search?query=&geo_latitude=&geo_longitude=&radius_km=`
- **Rate limit:** ~60 req/min on free tier

### Field mapping

| `EventCard` field | Luma field | Notes |
|---|---|---|
| `id` | `event.api_id` | stable, prefixed `evt-` |
| `title` | `event.name` | strip trailing emoji if present |
| `date` | `event.start_at` | ISO 8601, convert to user TZ |
| `location` | `event.geo_address_info.full_address` | fallback: `event.location.description` |
| `format` | `event.event_type` | `"offline"` → `in-person`, `"online"` → `online`, `"hybrid"` → `hybrid` |
| `price` | `event.ticket_info.is_free` | `true` → `free`, else `paid` |
| `priceAmount` | `event.ticket_info.min_price_cents / 100` | convert from cents |
| `currency` | `event.ticket_info.currency` | already ISO 4217 |
| `topics` | `event.tags[]` | normalize to internal taxonomy |
| `url` | `event.url` | `https://lu.ma/{event.slug}` |

---

## 2. Meetup

**Status:** needs OAuth setup + GraphQL adapter.

- **Base URL:** `https://api.meetup.com/gql`
- **Auth:** OAuth 2.0 — requires client_id + client_secret + user token  
  > ⚠️ **Important:** Meetup requires a **Pro account** ($29/mo) for full API access including `keywordSearch`. A standard account only returns events for groups the authenticated user belongs to. For a hackathon, use a Pro trial or a shared team account.
- **Protocol:** GraphQL (POST)
- **Rate limit:** 500 points/request; ~30 req/min burst limit

### Key query

```graphql
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
            duration
            isOnline
            venue { address city country lat lon }
            group { name urlname }
            going
            maxTickets
            eventType
            feeSettings { amount currency }
            topics { name }
          }
        }
      }
    }
  }
}
```

Variables:
```json
{
  "input": {
    "query": "AI fintech",
    "filter": {
      "source": "EVENTS",
      "lat": 45.464,
      "lon": 9.188,
      "radius": 50,
      "startDateRange": "2025-04-01T00:00:00",
      "endDateRange": "2025-06-30T00:00:00"
    }
  }
}
```

### Field mapping

| `EventCard` field | Meetup field | Notes |
|---|---|---|
| `id` | `id` | prefix with `meetup-` to avoid collisions |
| `title` | `title` | clean |
| `date` | `dateTime` | ISO 8601 with TZ offset |
| `location` | `venue.address + venue.city` | if `isOnline` → `"Online"` |
| `format` | `isOnline` | `true` → `online`, else `in-person` |
| `price` | `feeSettings` | null or 0 → `free`, else `paid` |
| `priceAmount` | `feeSettings.amount` | already in major currency unit |
| `currency` | `feeSettings.currency` | ISO 4217 |
| `topics` | `topics[].name` | normalize to internal taxonomy |
| `url` | `eventUrl` | direct link |

---

## 3. Ticketmaster Discovery API

**Status:** needs API key registration, straightforward REST adapter.

- **Base URL:** `https://app.ticketmaster.com/discovery/v2`
- **Auth:** `?apikey=YOUR_KEY` query param — free, instant registration at developer.ticketmaster.com
- **Rate limit:** 5,000 calls/day, 5 req/sec
- **Coverage:** excellent for EU — Italy, Germany, UK, Spain all well covered

### Key endpoint

```
GET /events.json
  ?apikey=YOUR_KEY
  &keyword=AI+fintech
  &latlong=45.464,9.188
  &radius=50
  &unit=km
  &classificationName=conference
  &startDateTime=2025-04-01T00:00:00Z
  &endDateTime=2025-06-30T00:00:00Z
  &size=50
  &sort=date,asc
```

### Field mapping

| `EventCard` field | Ticketmaster field | Notes |
|---|---|---|
| `id` | `id` | prefix with `tm-` |
| `title` | `name` | clean |
| `date` | `dates.start.dateTime` | ISO 8601 UTC; fallback `dates.start.localDate` |
| `location` | `_embedded.venues[0].name + city.name` | concatenate |
| `format` | `classifications[0].segment.name` | map: `"Music"` → `concert`, `"Sports"` → `sport`, `"Arts & Theatre"` → `performance`, etc. |
| `price` | `priceRanges[0]` | absent → `free` (rare), present → `paid` |
| `priceAmount` | `priceRanges[0].min` | use min; surface range in detail view |
| `currency` | `priceRanges[0].currency` | ISO 4217 |
| `topics` | `classifications[].genre.name` | normalize |
| `url` | `url` | direct ticketmaster link |

> ⚠️ Ticketmaster skews toward entertainment (concerts, sports, theatre) rather than professional/tech events. Good for completeness, not the primary source for the target audience. Filter by `classificationName=conference` or `classificationName=seminar` to reduce noise.

---

## 4. Eventbrite

**Status:** community MCP server exists; REST adapter straightforward but with a critical caveat.

- **Base URL:** `https://www.eventbriteapi.com/v3`
- **Auth:** Bearer token in `Authorization` header — free from eventbrite.com/account-settings/apps
- **Rate limit:** 2,000 req/hour

> ⚠️ **Critical:** The public event search endpoint (`GET /v3/events/search/`) was **deprecated in 2020** and no longer works for discovering events across the platform. The current public API only supports:
> - `GET /v3/events/{event_id}/` — fetch by ID  
> - `GET /v3/venues/{venue_id}/events/` — events at a specific venue  
> - `GET /v3/organizations/{org_id}/events/` — events by organizer  
>
> **Workaround options:**  
> 1. Use Zapier's Eventbrite MCP (paid) which wraps the internal search  
> 2. Intercept the internal `destination` API the Eventbrite website uses (`/api/v3/destination/search/`) — unofficial but functional  
> 3. Treat Eventbrite as a "register here" destination rather than a discovery source

### Field mapping (for ID-based fetch)

| `EventCard` field | Eventbrite field | Notes |
|---|---|---|
| `id` | `id` | prefix with `eb-` |
| `title` | `name.text` | |
| `date` | `start.local` | local datetime string, needs TZ from `start.timezone` |
| `location` | `venue.address.localized_address_display` | expand=venue required |
| `format` | `format.name` (via category expansion) | normalize |
| `price` | `is_free` | `true` → `free` |
| `priceAmount` | expand ticket_classes → min price | requires separate call |
| `currency` | `currency` | ISO 4217 |
| `topics` | `category.name + subcategory.name` | normalize |
| `url` | `url` | |

---

## 5. LinkedIn Events

**Status:** unofficial — use with caution.

LinkedIn's official Graph API does not expose public event search. However, their internal Voyager API (used by the LinkedIn web app) is accessible via session cookies and has been reverse-engineered by the community.

- **Base URL:** `https://www.linkedin.com/voyager/api/voyagerEventsV2/events`
- **Auth:** `li_at` cookie from an authenticated browser session
- **Stability:** ⚠️ can break without notice; not suitable for production, acceptable for hackathon

### Key params
```
?keywords=AI+Milan&start=0&count=20&filters=List(eventType->ONLINE,eventType->IN_PERSON)
```

### Field mapping

| `EventCard` field | LinkedIn field | Notes |
|---|---|---|
| `id` | `entityUrn` | strip `urn:li:event:` prefix |
| `title` | `title` | |
| `date` | `startTime` | Unix ms timestamp |
| `location` | `locationInfo.location` | or `"Online"` for virtual |
| `format` | `eventType` | `IN_PERSON` / `ONLINE` / `HYBRID` |
| `price` | not exposed | always set to `unknown`; surface "check event" |
| `url` | `vanityUrl` or constructed from `entityUrn` | |

> LinkedIn events are heavily professional/B2B — excellent fit for the target user persona. Worth the fragility for the hackathon demo.

---

## 6. Facebook Events

**Status:** official Graph API exists but heavily restricted.

- **Auth:** App Review required for `user_events` permission — weeks-long process  
- **Public search:** removed from Graph API in 2018 for privacy reasons  
- **Practical option:** Facebook-local event pages can be scraped via the public `?__a=1` JSON endpoint, but ToS prohibits this

**Recommendation:** deprioritize. The auth friction and ToS risk aren't worth it for a hackathon.

---

## 7. PredictHQ (bonus source)

**Status:** paid API but has a generous free trial — strong signal quality.

PredictHQ aggregates events from many sources, applies ML-based ranking, and adds attendance predictions. Uniquely useful for the `fitScore` layer.

- **Base URL:** `https://api.predicthq.com/v1/events`
- **Auth:** Bearer token, free trial available
- **Coverage:** global, EU strong
- **Key differentiator:** exposes `phq_attendance` (predicted attendance), `rank` (event significance score), and a rich `category` taxonomy

### Field mapping

| `EventCard` field | PredictHQ field | Notes |
|---|---|---|
| `id` | `id` | prefix `phq-` |
| `title` | `title` | |
| `date` | `start` | ISO 8601 |
| `location` | `geo.address` or `place_hierarchies[0][-1]` | |
| `format` | `entities[].type` | `"venue"` → in-person, `"event"` + no address → online |
| `price` | not exposed | omit or default `unknown` |
| `topics` | `category` + `labels[]` | normalize |
| `url` | not always available | construct from `title + location` search if absent |

---

## Normalization notes for the adapter layer

### `format` enum normalization

All sources use different terminology. Normalize at adapter level to a shared enum:

```typescript
type EventFormat = 'in-person' | 'online' | 'hybrid' | 'unknown';
```

| Raw value | Normalized |
|---|---|
| Luma: `"offline"` | `in-person` |
| Luma: `"online"` | `online` |
| Meetup: `isOnline: false` | `in-person` |
| Ticketmaster: no `online` flag | `in-person` (default) |
| LinkedIn: `"IN_PERSON"` | `in-person` |
| LinkedIn: `"HYBRID"` | `hybrid` |

### `price` enum normalization

```typescript
type PriceType = 'free' | 'paid' | 'unknown';
```

When `priceAmount` is 0 AND `price` field is `paid`, treat as `free` (some platforms list €0 tickets as paid).

### `topics` taxonomy

All sources return different tag/category systems. The LLM normalization step should map raw tags to a shared internal vocabulary before populating `topics[]`. Suggested top-level terms:

```
AI · machine-learning · fintech · payments · blockchain · startup · product · design ·
data · devops · cloud · security · web3 · sustainability · health · real-estate · networking
```

### `id` collision prevention

Each adapter must prefix its IDs:

| Source | Prefix |
|--------|--------|
| Luma | `luma-` |
| Meetup | `meetup-` |
| Ticketmaster | `tm-` |
| Eventbrite | `eb-` |
| LinkedIn | `li-` |
| PredictHQ | `phq-` |

### Deduplication strategy

The same event (e.g. a conference listed on both Luma and Eventbrite) must be merged into a single `EventCard`. Deduplication logic should run in the orchestration layer after all adapters return:

1. Normalize `title` (lowercase, strip punctuation)
2. Compare `date` within ±2 hours
3. Compare `location` (fuzzy address match or lat/lon within 200m)
4. If all three match → merge, keep the source with richer data, add secondary `source` to a `sources[]` array

---

## Recommended build order

| Order | Source | Why |
|---|---|---|
| ✅ 1 | Luma | Done |
| 2 | Meetup | GraphQL, good docs, EU coverage, best event quality for target users |
| 3 | Ticketmaster | REST, instant API key, excellent EU coverage, large catalog |
| 4 | LinkedIn Events | Unofficial but high-quality professional events, low implementation cost |
| 5 | Eventbrite | Workaround required for discovery; useful as registration destination |
| 6 | PredictHQ | Add if time permits; enriches `fitScore` with attendance signal |
| — | Facebook | Skip for now |