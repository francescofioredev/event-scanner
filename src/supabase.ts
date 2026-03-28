import type { UserProfile, EventCard, SavedEvent } from "@/types";

const PROJECT_ID = "zayxaqagtkewyugrcfvm";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheXhhcWFndGtld3l1Z3JjZnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDczNDksImV4cCI6MjA5MDI4MzM0OX0.q8PIDw5bhMFyU1cyjMhxYW27ZQP3vaD9KqfZ9HasjU8";
const REST = `https://${PROJECT_ID}.supabase.co/rest/v1`;

// ─── Low-level REST helper ────────────────────────────────────────────────────

interface ReqOpts {
  method?: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}

async function rest(path: string, accessToken: string, opts: ReqOpts = {}) {
  const res = await fetch(`${REST}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      ...opts.extraHeaders,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${opts.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  return null;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function profileToRow(userId: string, p: UserProfile) {
  return {
    id: userId,
    interests: p.interests,
    location: p.location,
    budget: p.budget,
    format_preferences: p.formatPreferences,
    goal: p.goal,
    updated_at: new Date().toISOString(),
  };
}

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    interests: row.interests as string[],
    location: row.location as string,
    budget: row.budget as UserProfile["budget"],
    formatPreferences: row.format_preferences as UserProfile["formatPreferences"],
    goal: row.goal as string,
  };
}

export async function getProfile(
  accessToken: string,
  userId: string,
): Promise<UserProfile | null> {
  const rows = await rest(
    `/user_profiles?id=eq.${userId}&select=*`,
    accessToken,
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rowToProfile(rows[0]);
}

export async function upsertProfile(
  accessToken: string,
  userId: string,
  profile: UserProfile,
): Promise<UserProfile> {
  const row = profileToRow(userId, profile);
  await rest("/user_profiles", accessToken, {
    method: "POST",
    body: row,
    extraHeaders: {
      Prefer: "resolution=merge-duplicates",
    },
  });
  return profile;
}

// ─── Saved events ─────────────────────────────────────────────────────────────

function rowToSavedEvent(row: Record<string, unknown>): SavedEvent {
  return {
    userId: row.user_id as string,
    eventId: row.event_id as string,
    eventData: row.event_data as EventCard,
    notes: row.notes as string,
    savedAt: row.saved_at as string,
  };
}

export async function getSavedEvents(
  accessToken: string,
  userId: string,
): Promise<SavedEvent[]> {
  const rows = await rest(
    `/saved_events?user_id=eq.${userId}&order=saved_at.desc&select=*`,
    accessToken,
  );
  if (!Array.isArray(rows)) return [];
  return rows.map(rowToSavedEvent);
}

export async function saveEvent(
  accessToken: string,
  userId: string,
  event: EventCard,
  notes = "",
): Promise<void> {
  await rest("/saved_events", accessToken, {
    method: "POST",
    body: {
      user_id: userId,
      event_id: event.id,
      event_data: event,
      notes,
    },
    extraHeaders: {
      Prefer: "resolution=merge-duplicates",
    },
  });
}

export async function unsaveEvent(
  accessToken: string,
  userId: string,
  eventId: string,
): Promise<void> {
  await rest(
    `/saved_events?user_id=eq.${userId}&event_id=eq.${eventId}`,
    accessToken,
    { method: "DELETE" },
  );
}
