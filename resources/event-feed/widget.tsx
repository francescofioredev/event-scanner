import { useState } from "react";
import { McpUseProvider, useWidget, useWidgetTheme, type WidgetMetadata } from "mcp-use/react";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const eventCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  location: z.string(),
  format: z.enum(["conference", "meetup", "hackathon", "workshop", "webinar", "festival", "concert", "networking"]),
  price: z.enum(["free", "paid", "unknown"]),
  priceAmount: z.number().optional(),
  currency: z.string().optional(),
  topics: z.array(z.string()),
  fitScore: z.number(),
  fitReason: z.string(),
  attendeeProfile: z.string(),
  source: z.enum(["luma", "meetup", "ticketmaster", "eventbrite", "linkedin", "predicthq", "tickadoo", "mock"]).optional(),
  url: z.string().optional(),
});

const propsSchema = z.object({
  query: z.string(),
  events: z.array(eventCardSchema),
  sources: z.record(z.string(), z.number()).optional(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Displays a scored list of events from live sources and mock data",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    invoking: "Scanning events...",
    invoked: "Events ready",
  },
};

type Props = z.infer<typeof propsSchema>;
type EventCard = z.infer<typeof eventCardSchema>;

type EventDetail = EventCard & {
  description: string;
  agenda: string[];
  perks: string[];
  logistics: { venue: string; duration: string; capacity?: number; website?: string };
  scoreBreakdown: { topic: number; attendees: number; schedule: number; budget: number; size: number };
};

type ViewState =
  | { view: "grid" }
  | { view: "detail"; card: EventCard; detail: EventDetail | null; loading: boolean; returnTo: "grid" | "saved" }
  | { view: "saved"; events: EventCard[]; loading: boolean };

// ─── Theme ────────────────────────────────────────────────────────────────────

function useColors() {
  const theme = useWidgetTheme();
  const dark = theme === "dark";
  return {
    bg: dark ? "#111827" : "#f9fafb",
    cardBg: dark ? "#1f2937" : "#ffffff",
    border: dark ? "#374151" : "#e5e7eb",
    text: dark ? "#f3f4f6" : "#111827",
    textSecondary: dark ? "#9ca3af" : "#6b7280",
    textMuted: dark ? "#6b7280" : "#9ca3af",
    accent: dark ? "#60a5fa" : "#2563eb",
    accentBg: dark ? "#1e3a5f" : "#dbeafe",
    topicBg: dark ? "#052e16" : "#dcfce7",
    topicText: dark ? "#4ade80" : "#16a34a",
    pricePaidBg: dark ? "#1e3a5f" : "#dbeafe",
    pricePaidText: dark ? "#93c5fd" : "#1d4ed8",
    networkingBg: dark ? "#2e1065" : "#ede9fe",
    networkingText: dark ? "#a78bfa" : "#7c3aed",
    perkBg: dark ? "#052e16" : "#dcfce7",
    perkText: dark ? "#4ade80" : "#16a34a",
    metricBg: dark ? "#1f2937" : "#f3f4f6",
    metricBorder: dark ? "#374151" : "#e5e7eb",
  };
}

// ─── Source dot config ────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  luma:         { label: "Luma",           color: "#5b4ccc" },
  meetup:       { label: "Meetup",         color: "#e02626" },
  ticketmaster: { label: "Ticketmaster",   color: "#b45309" },
  eventbrite:   { label: "Eventbrite",     color: "#d1410c" },
  linkedin:     { label: "LinkedIn",       color: "#0a66c2" },
  predicthq:    { label: "PredictHQ",      color: "#166534" },
  tickadoo:     { label: "Tickadoo",       color: "#9d174d" },
  mock:         { label: "Google Events",  color: "#4285f4" },
};

// ─── Tag categorization ──────────────────────────────────────────────────────

const NETWORKING_TOPICS = new Set(["networking", "startups", "co-founder", "fundraising", "business"]);

function getTagStyle(topic: string, colors: ReturnType<typeof useColors>) {
  if (NETWORKING_TOPICS.has(topic.toLowerCase())) {
    return { bg: colors.networkingBg, text: colors.networkingText };
  }
  return { bg: colors.topicBg, text: colors.topicText };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagPill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 9999,
      backgroundColor: bg,
      color: color,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.01em",
      lineHeight: "18px",
    }}>
      {label}
    </span>
  );
}

function SourceDot({ source, colors }: { source?: string; colors: ReturnType<typeof useColors> }) {
  const cfg = SOURCE_CONFIG[source || "mock"] || SOURCE_CONFIG.mock;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
      <span style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: cfg.color,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 400 }}>
        {cfg.label}
      </span>
    </div>
  );
}

function SectionLabel({ children, colors }: { children: string; colors: ReturnType<typeof useColors> }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    }}>
      {children}
    </span>
  );
}

// ─── Event Grid Card ──────────────────────────────────────────────────────────

function EventGridCard({ event, colors, onSelect }: {
  event: EventCard;
  colors: ReturnType<typeof useColors>;
  onSelect: (event: EventCard) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const priceLabel = event.price === "free"
    ? "free"
    : event.priceAmount
      ? `${event.priceAmount} ${event.currency || "EUR"}`
      : null;

  const priceBg = event.price === "free" ? colors.topicBg : colors.pricePaidBg;
  const priceColor = event.price === "free" ? colors.topicText : colors.pricePaidText;

  return (
    <div
      onClick={() => onSelect(event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: colors.cardBg,
        border: `1px solid ${hovered ? colors.accent + "55" : colors.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxShadow: hovered
          ? "0 4px 16px rgba(0,0,0,0.15)"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Date */}
      <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 400 }}>
        {event.date}
      </span>

      {/* Title */}
      <h3 style={{
        margin: 0,
        fontSize: 15,
        fontWeight: 700,
        color: colors.text,
        lineHeight: 1.3,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      }}>
        {event.title}
      </h3>

      {/* Location */}
      <span style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 400 }}>
        {event.location}
      </span>

      {/* Tags */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
        {event.topics.slice(0, 2).map((t) => {
          const style = getTagStyle(t, colors);
          return <TagPill key={t} label={t.toLowerCase()} bg={style.bg} color={style.text} />;
        })}
        {priceLabel && (
          <TagPill label={priceLabel} bg={priceBg} color={priceColor} />
        )}
      </div>

      {/* Source */}
      <SourceDot source={event.source} colors={colors} />
    </div>
  );
}

// ─── Event Detail View (replaces grid) ────────────────────────────────────────

function buildCalendarUrl(event: EventCard | EventDetail) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmtYMD = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const fmtFull = (d: Date) =>
    `${fmtYMD(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  let startDate: Date;
  let endDate: Date;
  let allDay = true;

  try {
    const dateStr = event.date;

    // "May 7, 2026, 09:00–May 9, 2026, 18:00" (multi-day with times)
    const multiDayTime = dateStr.match(
      /^(\w+ \d+, \d{4}),?\s*(\d{2}:\d{2})\s*[–\-]\s*(\w+ \d+, \d{4}),?\s*(\d{2}:\d{2})$/
    );
    if (multiDayTime) {
      startDate = new Date(`${multiDayTime[1]} ${multiDayTime[2]}`);
      endDate = new Date(`${multiDayTime[3]} ${multiDayTime[4]}`);
      allDay = false;
    } else {
      // "May 19, 2026, 09:00–18:00" (single day with time range)
      const singleDayTime = dateStr.match(
        /^(\w+ \d+, \d{4}),?\s*(\d{2}:\d{2})\s*[–\-]\s*(\d{2}:\d{2})$/
      );
      if (singleDayTime) {
        startDate = new Date(`${singleDayTime[1]} ${singleDayTime[2]}`);
        endDate = new Date(`${singleDayTime[1]} ${singleDayTime[3]}`);
        allDay = false;
      } else {
        // "Apr 20–21, 2026" (date range, all day)
        const rangeMatch = dateStr.match(
          /^(\w+ \d+)\s*[–\-]\s*(\d+),?\s*(\d{4})$/
        );
        if (rangeMatch) {
          startDate = new Date(`${rangeMatch[1]}, ${rangeMatch[3]}`);
          endDate = new Date(startDate);
          endDate.setDate(parseInt(rangeMatch[2], 10) + 1);
        } else {
          startDate = new Date(dateStr);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
        }
      }
    }

    if (isNaN(startDate!.getTime())) throw new Error("bad date");
  } catch {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  }

  const dates = allDay
    ? `${fmtYMD(startDate!)}/${fmtYMD(endDate!)}`
    : `${fmtFull(startDate!)}/${fmtFull(endDate!)}`;

  const details = [
    event.attendeeProfile,
    event.url && `More info: ${event.url}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    location: event.location,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function EventDetailView({ card, detail, loading, onBack, colors, isSavedView, onUnsaved }: {
  card: EventCard;
  detail: EventDetail | null;
  loading: boolean;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
  isSavedView?: boolean;
  onUnsaved?: (eventId: string) => void;
}) {
  const { openExternal, callTool } = useWidget<Props>();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [removeStatus, setRemoveStatus] = useState<"idle" | "removing" | "removed" | "error">("idle");

  const event = detail || card;
  const siteUrl = detail?.logistics?.website || detail?.url || card.url;

  return (
    <div style={{
      padding: "16px 20px",
      backgroundColor: colors.bg,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* Back link */}
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: colors.accent,
          fontSize: 13,
          fontWeight: 500,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {isSavedView ? "Back to saved events" : "Back to results"}
      </button>

      {/* Title */}
      <h2 style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        color: colors.text,
        lineHeight: 1.3,
      }}>
        {event.title}
      </h2>

      {/* Date */}
      <span style={{ fontSize: 13, color: colors.textSecondary, marginTop: -8 }}>
        {event.date}{detail?.logistics?.duration ? ` \u2013 ${detail.logistics.duration}` : ""}
      </span>

      {/* Loading state */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {[80, 100, 60].map((w, i) => (
            <div key={i} style={{
              height: 12,
              width: `${w}%`,
              borderRadius: 4,
              backgroundColor: colors.border,
              opacity: 0.5,
            }} />
          ))}
        </div>
      )}

      {/* Detail content */}
      {detail && !loading && (
        <>
          {/* Description */}
          {detail.description && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SectionLabel colors={colors}>Description</SectionLabel>
              <p style={{
                margin: 0,
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 1.7,
              }}>
                {detail.description}
              </p>
            </div>
          )}

          {/* Perks */}
          {detail.perks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionLabel colors={colors}>Perks</SectionLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detail.perks.map((perk, i) => (
                  <TagPill key={i} label={perk} bg={colors.perkBg} color={colors.perkText} />
                ))}
              </div>
            </div>
          )}

          {/* At a Glance */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionLabel colors={colors}>At a glance</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}>
              {detail.logistics.capacity && (
                <div style={{
                  backgroundColor: colors.metricBg,
                  border: `1px solid ${colors.metricBorder}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>
                    {detail.logistics.capacity}
                  </span>
                  <span style={{ fontSize: 11, color: colors.textMuted }}>attendees</span>
                </div>
              )}
              <div style={{
                backgroundColor: colors.metricBg,
                border: `1px solid ${colors.metricBorder}`,
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }}>
                  {detail.attendeeProfile.split(",")[0].trim()}
                </span>
                <span style={{ fontSize: 11, color: colors.textMuted }}>organizer</span>
              </div>
              <div style={{
                backgroundColor: colors.metricBg,
                border: `1px solid ${colors.metricBorder}`,
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }}>
                  {detail.location}
                </span>
                <span style={{ fontSize: 11, color: colors.textMuted }}>distance</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => openExternal(buildCalendarUrl(event))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: "transparent",
                color: colors.text,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "border-color 0.15s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Add to calendar
            </button>
            {isSavedView ? (
              <button
                onClick={async () => {
                  if (removeStatus !== "idle") return;
                  setRemoveStatus("removing");
                  try {
                    await callTool("unsave-event", { eventId: event.id });
                    setRemoveStatus("removed");
                    onUnsaved?.(event.id);
                  } catch {
                    setRemoveStatus("error");
                  }
                }}
                disabled={removeStatus !== "idle"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: `1px solid ${removeStatus === "removed" ? colors.textMuted : removeStatus === "error" ? "#f87171" : colors.border}`,
                  backgroundColor: removeStatus === "removed" ? colors.metricBg : "transparent",
                  color: removeStatus === "removed" ? colors.textMuted : removeStatus === "error" ? "#f87171" : colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: removeStatus === "idle" ? "pointer" : "default",
                  transition: "border-color 0.15s ease, background-color 0.15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={removeStatus === "idle" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                {removeStatus === "idle" ? "Remove from saved" : removeStatus === "removing" ? "Removing..." : removeStatus === "removed" ? "Removed" : "Error"}
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (saveStatus !== "idle") return;
                  setSaveStatus("saving");
                  try {
                    await callTool("save-event", { eventId: event.id });
                    setSaveStatus("saved");
                  } catch {
                    setSaveStatus("error");
                  }
                }}
                disabled={saveStatus !== "idle"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: `1px solid ${saveStatus === "saved" ? colors.perkText : colors.border}`,
                  backgroundColor: saveStatus === "saved" ? colors.perkBg : "transparent",
                  color: saveStatus === "saved" ? colors.perkText : saveStatus === "error" ? "#f87171" : colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saveStatus === "idle" ? "pointer" : "default",
                  transition: "border-color 0.15s ease, background-color 0.15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                {saveStatus === "idle" ? "Save" : saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Error"}
              </button>
            )}
            {siteUrl && (
              <button
                onClick={() => openExternal(siteUrl)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: "transparent",
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open in site
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <McpUseProvider>
      <div style={{
        backgroundColor: colors.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 16px 10px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ height: 14, width: 100, borderRadius: 4, backgroundColor: colors.border, opacity: 0.6 }} />
          <div style={{ height: 20, width: 60, borderRadius: 9999, backgroundColor: colors.border, opacity: 0.4 }} />
        </div>
        <div style={{
          flex: 1,
          padding: "12px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              <div style={{ height: 10, width: "40%", borderRadius: 4, backgroundColor: colors.border, opacity: 0.4 }} />
              <div style={{ height: 14, width: "80%", borderRadius: 4, backgroundColor: colors.border, opacity: 0.6 }} />
              <div style={{ height: 10, width: "60%", borderRadius: 4, backgroundColor: colors.border, opacity: 0.3 }} />
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ width: 40, height: 16, borderRadius: 9999, backgroundColor: colors.border, opacity: 0.3 }} />
                <div style={{ width: 32, height: 16, borderRadius: 9999, backgroundColor: colors.border, opacity: 0.3 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: colors.border, opacity: 0.4 }} />
                <div style={{ width: 50, height: 10, borderRadius: 4, backgroundColor: colors.border, opacity: 0.3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </McpUseProvider>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function EventFeed() {
  const { props, isPending, callTool } = useWidget<Props>();
  const colors = useColors();
  const [viewState, setViewState] = useState<ViewState>({ view: "grid" });
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  if (isPending) {
    return <LoadingSkeleton colors={colors} />;
  }

  const { query, events } = props;
  const sorted = [...events].sort((a, b) => b.fitScore - a.fitScore);
  const isSavedProps = query === "saved";

  async function handleSelectCard(event: EventCard, returnTo: "grid" | "saved" = "grid") {
    setViewState({ view: "detail", card: event, detail: null, loading: true, returnTo });
    try {
      const res = await callTool("get-event-detail", { id: event.id });
      const detail = (res.structuredContent as any)?.event as EventDetail | undefined;
      setViewState((prev) =>
        prev.view === "detail"
          ? { ...prev, detail: detail || null, loading: false }
          : prev
      );
    } catch {
      setViewState((prev) =>
        prev.view === "detail" ? { ...prev, loading: false } : prev
      );
    }
  }

  async function handleViewSaved() {
    setViewState({ view: "saved", events: [], loading: true });
    setRemovedIds(new Set());
    try {
      const res = await callTool("get-saved-events", {});
      const savedEvents = ((res.structuredContent as any)?.events ?? []) as EventCard[];
      setViewState({ view: "saved", events: savedEvents, loading: false });
    } catch {
      setViewState({ view: "saved", events: [], loading: false });
    }
  }

  function handleUnsaved(eventId: string) {
    setRemovedIds((prev) => new Set(prev).add(eventId));
  }

  // ─── Detail view ──────────────────────────────────────────────────────────

  if (viewState.view === "detail") {
    const fromSaved = viewState.returnTo === "saved";
    return (
      <McpUseProvider autoSize>
        <EventDetailView
          card={viewState.card}
          detail={viewState.detail}
          loading={viewState.loading}
          onBack={() => {
            if (fromSaved) {
              handleViewSaved();
            } else {
              setViewState({ view: "grid" });
            }
          }}
          colors={colors}
          isSavedView={fromSaved || isSavedProps}
          onUnsaved={handleUnsaved}
        />
      </McpUseProvider>
    );
  }

  // ─── Saved events view ──────────────────────────────────────────────────────

  if (viewState.view === "saved") {
    if (viewState.loading) {
      return <LoadingSkeleton colors={colors} />;
    }

    const savedFiltered = viewState.events.filter((e) => !removedIds.has(e.id));
    const savedSorted = [...savedFiltered].sort((a, b) => b.fitScore - a.fitScore);

    return (
      <McpUseProvider autoSize>
        <div style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: colors.bg,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px 10px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setViewState({ view: "grid" })}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: colors.accent,
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
            <h2 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: colors.text,
              letterSpacing: "-0.01em",
              flex: 1,
            }}>
              Your Saved Events
            </h2>
            <span style={{
              padding: "3px 10px",
              borderRadius: 9999,
              backgroundColor: colors.accentBg,
              color: colors.accent,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {savedFiltered.length} saved
            </span>
          </div>

          {/* Saved events grid */}
          <div style={{
            padding: "12px 16px",
            display: savedSorted.length === 0 ? "flex" : "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
            overflowY: "auto",
          }}>
            {savedSorted.length === 0 ? (
              <div style={{
                padding: "40px 20px",
                textAlign: "center",
                color: colors.textMuted,
                width: "100%",
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.5 }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <p style={{ margin: 0, fontSize: 13 }}>
                  You haven't saved any events yet. Browse events and tap Save to bookmark them.
                </p>
              </div>
            ) : (
              savedSorted.map((event) => (
                <EventGridCard
                  key={event.id}
                  event={event}
                  colors={colors}
                  onSelect={(e) => handleSelectCard(e, "saved")}
                />
              ))
            )}
          </div>
        </div>
      </McpUseProvider>
    );
  }

  // ─── Grid view ────────────────────────────────────────────────────────────

  return (
    <McpUseProvider autoSize>
      <div style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.bg,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px 10px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: "-0.01em",
          }}>
            {isSavedProps ? "Your Saved Events" : query ? `"${query}"` : "All Events"}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              padding: "3px 10px",
              borderRadius: 9999,
              backgroundColor: colors.accentBg,
              color: colors.accent,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {events.length} {isSavedProps ? "saved" : "found"}
            </span>
            {!isSavedProps && (
              <button
                onClick={handleViewSaved}
                title="View saved events"
                style={{
                  background: "none",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: colors.textSecondary,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  transition: "border-color 0.15s ease, color 0.15s ease",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                Saved
              </button>
            )}
          </div>
        </div>

        {/* Event grid */}
        <div style={{
          padding: "12px 16px",
          display: sorted.length === 0 ? "flex" : "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          overflowY: "auto",
        }}>
          {sorted.length === 0 ? (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              color: colors.textMuted,
              width: "100%",
            }}>
              <p style={{ margin: 0, fontSize: 13 }}>
                No events found{query ? ` matching "${query}"` : ""}. Try a different keyword.
              </p>
            </div>
          ) : (
            sorted.map((event) => (
              <EventGridCard
                key={event.id}
                event={event}
                colors={colors}
                onSelect={handleSelectCard}
              />
            ))
          )}
        </div>
      </div>
    </McpUseProvider>
  );
}
