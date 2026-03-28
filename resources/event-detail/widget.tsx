import { useState } from "react";
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
  price: z.enum(["free", "paid", "unknown"]),
  priceAmount: z.number().optional(),
  currency: z.string().optional(),
  topics: z.array(z.string()),
  fitScore: z.number(),
  fitReason: z.string(),
  attendeeProfile: z.string(),
  source: z.enum(["luma", "meetup", "ticketmaster", "eventbrite", "linkedin", "predicthq", "tickadoo", "mock"]).optional(),
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
    text: dark ? "#f3f4f6" : "#111827",
    textSecondary: dark ? "#9ca3af" : "#6b7280",
    textMuted: dark ? "#6b7280" : "#9ca3af",
    accent: dark ? "#60a5fa" : "#2563eb",
    perkBg: dark ? "#052e16" : "#dcfce7",
    perkText: dark ? "#4ade80" : "#16a34a",
    metricBg: dark ? "#1f2937" : "#f3f4f6",
    metricBorder: dark ? "#374151" : "#e5e7eb",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function PerkPill({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 9999,
      backgroundColor: colors.perkBg,
      color: colors.perkText,
      fontSize: 11,
      fontWeight: 600,
      lineHeight: "18px",
    }}>
      {label}
    </span>
  );
}

function buildCalendarUrl(event: EventDetail) {
  const title = encodeURIComponent(event.title);
  const location = encodeURIComponent(event.location);
  const details = encodeURIComponent(
    `${event.attendeeProfile}\n${event.url || ""}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&location=${location}&details=${details}`;
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function EventDetailWidget() {
  const { props, isPending, openExternal, callTool } = useWidget<Props>();
  const colors = useColors();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (isPending || !props?.event) {
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
  const siteUrl = event.logistics.website || event.url;

  return (
    <McpUseProvider autoSize>
      <div style={{
        padding: "16px 20px",
        backgroundColor: colors.bg,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
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

        {/* Date + duration */}
        <span style={{ fontSize: 13, color: colors.textSecondary, marginTop: -8 }}>
          {event.date}{event.logistics.duration ? ` \u2013 ${event.logistics.duration}` : ""}
        </span>

        {/* Description */}
        {event.description && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SectionLabel colors={colors}>Description</SectionLabel>
            <p style={{
              margin: 0,
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 1.7,
            }}>
              {event.description}
            </p>
          </div>
        )}

        {/* Perks */}
        {event.perks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionLabel colors={colors}>Perks</SectionLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {event.perks.map((perk, i) => (
                <PerkPill key={i} label={perk} colors={colors} />
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
            {event.logistics.capacity && (
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
                  {event.logistics.capacity}
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
                {event.attendeeProfile.split(",")[0].trim()}
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
                {event.logistics.venue}
              </span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>venue</span>
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
      </div>
    </McpUseProvider>
  );
}
