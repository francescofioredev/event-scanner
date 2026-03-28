import { McpUseProvider, useWidget, useWidgetTheme, type WidgetMetadata } from "mcp-use/react";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const scoreBreakdownSchema = z.object({
  topic: z.number(),
  attendees: z.number(),
  schedule: z.number(),
  budget: z.number(),
  size: z.number(),
});

const eventDetailSchema = z.object({
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
  description: z.string(),
  agenda: z.array(z.string()),
  perks: z.array(z.string()),
  logistics: z.object({
    venue: z.string(),
    duration: z.string(),
    capacity: z.number().optional(),
    website: z.string().optional(),
  }),
  scoreBreakdown: scoreBreakdownSchema,
});

const propsSchema = z.object({
  event: eventDetailSchema,
});

export const widgetMetadata: WidgetMetadata = {
  description: "Full event detail panel with fit score breakdown, agenda, perks, and logistics",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    invoking: "Loading event details...",
    invoked: "Event details ready",
  },
};

type Props = z.infer<typeof propsSchema>;
type EventDetail = z.infer<typeof eventDetailSchema>;

// ─── Theme ────────────────────────────────────────────────────────────────────

function useColors() {
  const theme = useWidgetTheme();
  const dark = theme === "dark";
  return {
    bg: dark ? "#111827" : "#f9fafb",
    cardBg: dark ? "#1f2937" : "#ffffff",
    border: dark ? "#374151" : "#e5e7eb",
    sectionBg: dark ? "#161e2e" : "#f3f4f6",
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
    ctaBg: dark ? "#4f46e5" : "#6366f1",
    ctaText: "#ffffff",
    ctaHoverBg: dark ? "#4338ca" : "#4f46e5",
  };
}

// ─── Format config ────────────────────────────────────────────────────────────

const FORMAT_CONFIG: Record<EventDetail["format"], { label: string; emoji: string; bg: string; color: string }> = {
  conference: { label: "Conference", emoji: "🎤", bg: "#ede9fe", color: "#7c3aed" },
  meetup:     { label: "Meetup",     emoji: "🤝", bg: "#d1fae5", color: "#065f46" },
  hackathon:  { label: "Hackathon",  emoji: "⚡", bg: "#fef3c7", color: "#92400e" },
  workshop:   { label: "Workshop",   emoji: "🛠️", bg: "#fce7f3", color: "#9d174d" },
  webinar:    { label: "Webinar",    emoji: "💻", bg: "#e0f2fe", color: "#0369a1" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreDimensionBar({
  label,
  score,
  colors,
}: {
  label: string;
  score: number;
  colors: ReturnType<typeof useColors>;
}) {
  const isHigh = score >= 70;
  const isMid = score >= 40 && score < 70;
  const barColor = isHigh ? colors.scoreHigh : isMid ? colors.scoreMid : colors.scoreLow;
  const badgeBg = isHigh ? colors.scoreHighBg : isMid ? colors.scoreMidBg : colors.scoreLowBg;
  const badgeText = isHigh ? colors.scoreHigh : isMid ? colors.scoreMid : colors.scoreLow;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 80, fontSize: 12, color: colors.textSecondary, flexShrink: 0 }}>{label}</span>
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
      <span style={{
        width: 32,
        padding: "1px 4px",
        borderRadius: 4,
        backgroundColor: badgeBg,
        color: badgeText,
        fontSize: 11,
        fontWeight: 700,
        textAlign: "center",
        flexShrink: 0,
      }}>
        {score}
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
    }}>
      {topic}
    </span>
  );
}

function RegisterInterestButton({
  event,
  colors,
}: {
  event: EventDetail;
  colors: ReturnType<typeof useColors>;
}) {
  const { sendFollowUpMessage, openExternal } = useWidget<Props>();

  function handleClick() {
    if (event.logistics.website) {
      openExternal(event.logistics.website);
    } else {
      sendFollowUpMessage(`I want to register my interest for "${event.title}". Can you help me?`);
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        width: "100%",
        padding: "10px 16px",
        borderRadius: 8,
        border: "none",
        backgroundColor: colors.ctaBg,
        color: colors.ctaText,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.01em",
      }}
    >
      Register Interest →
    </button>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function EventDetailWidget() {
  const { props, isPending } = useWidget<Props>();
  const colors = useColors();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div style={{ padding: 16, backgroundColor: colors.bg, display: "flex", flexDirection: "column", gap: 12 }}>
          {[80, 60, 100, 70].map((w, i) => (
            <div key={i} style={{ height: 14, width: `${w}%`, borderRadius: 4, backgroundColor: colors.border, opacity: 0.5 }} />
          ))}
        </div>
      </McpUseProvider>
    );
  }

  const { event } = props;
  const fmtCfg = FORMAT_CONFIG[event.format];
  const priceLabel = event.price === "free" ? "Free" : `${event.currency}${event.priceAmount}`;

  return (
    <McpUseProvider autoSize>
      <div style={{
        padding: 16,
        backgroundColor: colors.bg,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 8px",
              borderRadius: 6,
              backgroundColor: fmtCfg.bg,
              color: fmtCfg.color,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              {fmtCfg.emoji} {fmtCfg.label}
            </span>
            <span style={{
              padding: "2px 8px",
              borderRadius: 9999,
              backgroundColor: event.price === "free" ? colors.scoreHighBg : colors.accentBg,
              color: event.price === "free" ? colors.scoreHigh : colors.accent,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {priceLabel}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text, lineHeight: 1.3 }}>
            {event.url ? (
              <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ color: colors.accent, textDecoration: "none" }}>
                {event.title}
              </a>
            ) : (
              event.title
            )}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>📅 {event.date}</span>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>📍 {event.location}</span>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>👥 {event.attendeeProfile}</span>
          </div>
        </div>

        {/* Topics */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {event.topics.map((t) => (
            <TopicChip key={t} topic={t} colors={colors} />
          ))}
        </div>

        {/* Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionLabel colors={colors}>About</SectionLabel>
          <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
            {event.description}
          </p>
        </div>

        {/* Fit score breakdown */}
        <div style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionLabel colors={colors}>Fit Score Breakdown</SectionLabel>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              color: event.fitScore >= 70 ? colors.scoreHigh : event.fitScore >= 40 ? colors.scoreMid : colors.scoreLow,
              letterSpacing: "-0.03em",
            }}>
              {event.fitScore}
            </span>
          </div>
          <ScoreDimensionBar label="Topic"     score={event.scoreBreakdown.topic}     colors={colors} />
          <ScoreDimensionBar label="Attendees" score={event.scoreBreakdown.attendees} colors={colors} />
          <ScoreDimensionBar label="Schedule"  score={event.scoreBreakdown.schedule}  colors={colors} />
          <ScoreDimensionBar label="Budget"    score={event.scoreBreakdown.budget}    colors={colors} />
          <ScoreDimensionBar label="Size"      score={event.scoreBreakdown.size}      colors={colors} />
          <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.4, borderTop: `1px solid ${colors.border}`, paddingTop: 8 }}>
            {event.fitReason}
          </p>
        </div>

        {/* Agenda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel colors={colors}>Agenda</SectionLabel>
          <div style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {event.agenda.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "9px 14px",
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 1.4,
                  borderBottom: i < event.agenda.length - 1 ? `1px solid ${colors.border}` : "none",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Perks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel colors={colors}>Perks</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {event.perks.map((perk, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: colors.scoreHigh, fontSize: 13, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.4 }}>{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logistics */}
        <div style={{
          backgroundColor: colors.sectionBg,
          borderRadius: 10,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <SectionLabel colors={colors}>Logistics</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>🏛 {event.logistics.venue}</span>
            <span style={{ fontSize: 13, color: colors.textSecondary }}>⏱ {event.logistics.duration}</span>
            {event.logistics.capacity && (
              <span style={{ fontSize: 13, color: colors.textSecondary }}>👤 Up to {event.logistics.capacity} attendees</span>
            )}
          </div>
        </div>

        {/* CTA */}
        <RegisterInterestButton event={event} colors={colors} />
      </div>
    </McpUseProvider>
  );
}
