import { McpUseProvider, useWidget, useWidgetTheme, type WidgetMetadata } from "mcp-use/react";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const eventCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  location: z.string(),
  format: z.enum(["conference", "meetup", "hackathon", "workshop", "webinar"]),
  price: z.enum(["free", "paid"]),
  priceAmount: z.number().optional(),
  currency: z.string().optional(),
  topics: z.array(z.string()),
  fitScore: z.number(),
  fitReason: z.string(),
  attendeeProfile: z.string(),
  source: z.enum(["eventbrite", "luma", "mock"]).optional(),
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
    accent: dark ? "#818cf8" : "#6366f1",
    accentBg: dark ? "#1e1b4b" : "#eef2ff",
    scoreHigh: dark ? "#4ade80" : "#16a34a",
    scoreMid: dark ? "#fcd34d" : "#d97706",
    scoreLow: dark ? "#f87171" : "#dc2626",
    scoreHighBg: dark ? "#052e16" : "#dcfce7",
    scoreMidBg: dark ? "#451a03" : "#fef3c7",
    scoreLowBg: dark ? "#450a0a" : "#fee2e2",
    tagBg: dark ? "#1e3a5f" : "#dbeafe",
    tagText: dark ? "#93c5fd" : "#1d4ed8",
  };
}

// ─── Source badge config ────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  eventbrite: { label: "Eventbrite", bg: "#fff1eb", color: "#d1410c" },
  luma:       { label: "Luma",       bg: "#f0eeff", color: "#5b4ccc" },
  mock:       { label: "Demo",       bg: "#f3f4f6", color: "#6b7280" },
};

// ─── Format badge config ────────────────────────────────────────────────────────

const FORMAT_CONFIG: Record<EventCard["format"], { label: string; emoji: string; bg: string; color: string }> = {
  conference: { label: "Conference", emoji: "🎤", bg: "#ede9fe", color: "#7c3aed" },
  meetup:     { label: "Meetup",     emoji: "🤝", bg: "#d1fae5", color: "#065f46" },
  hackathon:  { label: "Hackathon",  emoji: "⚡", bg: "#fef3c7", color: "#92400e" },
  workshop:   { label: "Workshop",   emoji: "🛠️", bg: "#fce7f3", color: "#9d174d" },
  webinar:    { label: "Webinar",    emoji: "💻", bg: "#e0f2fe", color: "#0369a1" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: string }) {
  const cfg = SOURCE_CONFIG[source || "mock"] || SOURCE_CONFIG.mock;
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 4,
      backgroundColor: cfg.bg,
      color: cfg.color,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.02em",
    }}>
      {cfg.label}
    </span>
  );
}

function FitScoreBar({ score, colors }: { score: number; colors: ReturnType<typeof useColors> }) {
  const isHigh = score >= 70;
  const isMid = score >= 40 && score < 70;

  const barColor = isHigh ? colors.scoreHigh : isMid ? colors.scoreMid : colors.scoreLow;
  const badgeBg = isHigh ? colors.scoreHighBg : isMid ? colors.scoreMidBg : colors.scoreLowBg;
  const badgeText = isHigh ? colors.scoreHigh : isMid ? colors.scoreMid : colors.scoreLow;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        minWidth: 40,
        padding: "2px 6px",
        borderRadius: 6,
        backgroundColor: badgeBg,
        color: badgeText,
        fontSize: 13,
        fontWeight: 700,
        textAlign: "center",
        letterSpacing: "-0.02em",
      }}>
        {score}
      </div>
      <div style={{
        flex: 1,
        height: 6,
        borderRadius: 9999,
        backgroundColor: "rgba(156,163,175,0.2)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${score}%`,
          height: "100%",
          borderRadius: 9999,
          backgroundColor: barColor,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function TopicChip({ topic, colors }: { topic: string; colors: ReturnType<typeof useColors> }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 9999,
      backgroundColor: colors.tagBg,
      color: colors.tagText,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.01em",
    }}>
      {topic}
    </span>
  );
}

function FormatBadge({ format }: { format: EventCard["format"] }) {
  const cfg = FORMAT_CONFIG[format];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "2px 8px",
      borderRadius: 6,
      backgroundColor: cfg.bg,
      color: cfg.color,
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function PricePill({ event, colors }: { event: EventCard; colors: ReturnType<typeof useColors> }) {
  if (event.price === "free") {
    return (
      <span style={{
        padding: "2px 8px",
        borderRadius: 9999,
        backgroundColor: colors.scoreHighBg,
        color: colors.scoreHigh,
        fontSize: 12,
        fontWeight: 600,
      }}>
        Free
      </span>
    );
  }
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 9999,
      backgroundColor: colors.accentBg,
      color: colors.accent,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {event.currency}{event.priceAmount}
    </span>
  );
}

function EventCardItem({ event, colors }: { event: EventCard; colors: ReturnType<typeof useColors> }) {
  const titleContent = (
    <h3 style={{
      margin: 0,
      fontSize: 15,
      fontWeight: 700,
      color: event.url ? colors.accent : colors.text,
      lineHeight: 1.3,
      flex: 1,
      textDecoration: "none",
    }}>
      {event.title}
    </h3>
  );

  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Header row: source + title + format badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SourceBadge source={event.source} />
            <FormatBadge format={event.format} />
          </div>
          {event.url ? (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              {titleContent}
            </a>
          ) : (
            titleContent
          )}
        </div>
      </div>

      {/* Meta row: date, location, attendees */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 3 }}>
          📅 {event.date}
        </span>
        <span style={{ fontSize: 12, color: colors.textSecondary, display: "flex", alignItems: "center", gap: 3 }}>
          📍 {event.location}
        </span>
        <span style={{ fontSize: 12, color: colors.textMuted }}>
          👥 {event.attendeeProfile}
        </span>
      </div>

      {/* Topics + price row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {event.topics.map((t) => (
          <TopicChip key={t} topic={t} colors={colors} />
        ))}
        <div style={{ marginLeft: "auto" }}>
          <PricePill event={event} colors={colors} />
        </div>
      </div>

      {/* Fit score */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Fit
        </span>
        <FitScoreBar score={event.fitScore} colors={colors} />
        <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 }}>
          {event.fitReason}
        </p>
      </div>
    </div>
  );
}

function SourceSummary({ sources, colors }: { sources?: Record<string, number>; colors: ReturnType<typeof useColors> }) {
  if (!sources || Object.keys(sources).length <= 1) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {Object.entries(sources).map(([source, count]) => {
        const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.mock;
        return (
          <span key={source} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 9999,
            backgroundColor: cfg.bg,
            color: cfg.color,
            fontSize: 11,
            fontWeight: 600,
          }}>
            {cfg.label}: {count}
          </span>
        );
      })}
    </div>
  );
}

function LoadingSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <McpUseProvider autoSize>
      <div style={{ padding: 16, backgroundColor: colors.bg, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
        }}>
          <div style={{ height: 14, width: 120, borderRadius: 4, backgroundColor: colors.border, opacity: 0.6 }} />
          <div style={{ height: 14, width: 80, borderRadius: 9999, backgroundColor: colors.border, opacity: 0.4 }} />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ height: 14, width: 60, borderRadius: 4, backgroundColor: colors.border, opacity: 0.5 }} />
              <div style={{ height: 14, width: 80, borderRadius: 4, backgroundColor: colors.border, opacity: 0.5 }} />
            </div>
            <div style={{ height: 16, width: "70%", borderRadius: 4, backgroundColor: colors.border, opacity: 0.6 }} />
            <div style={{ height: 12, width: "90%", borderRadius: 4, backgroundColor: colors.border, opacity: 0.3 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {[50, 40, 60].map((w, j) => (
                <div key={j} style={{ height: 18, width: w, borderRadius: 9999, backgroundColor: colors.border, opacity: 0.4 }} />
              ))}
            </div>
            <div style={{ height: 6, width: "100%", borderRadius: 9999, backgroundColor: colors.border, opacity: 0.3 }} />
          </div>
        ))}
      </div>
    </McpUseProvider>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function EventFeed() {
  const { props, isPending } = useWidget<Props>();
  const colors = useColors();

  if (isPending) {
    return <LoadingSkeleton colors={colors} />;
  }

  const { query, events, sources } = props;
  const sorted = [...events].sort((a, b) => b.fitScore - a.fitScore);

  return (
    <McpUseProvider autoSize>
      <div style={{
        padding: 16,
        backgroundColor: colors.bg,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: colors.text,
            }}>
              {query ? `Events: "${query}"` : "All Events"}
            </h2>
            <span style={{
              padding: "3px 10px",
              borderRadius: 9999,
              backgroundColor: colors.accentBg,
              color: colors.accent,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {events.length} found
            </span>
          </div>
          <SourceSummary sources={sources} colors={colors} />
        </div>

        {/* Event list */}
        {sorted.length === 0 ? (
          <div style={{
            padding: "40px 20px",
            textAlign: "center",
            color: colors.textMuted,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ margin: 0, fontSize: 14 }}>
              No events found{query ? ` matching "${query}"` : ""}. Try a different keyword.
            </p>
          </div>
        ) : (
          sorted.map((event) => (
            <EventCardItem key={event.id} event={event} colors={colors} />
          ))
        )}
      </div>
    </McpUseProvider>
  );
}
