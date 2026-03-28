-- ============================================================
-- Event Scanner — initial Supabase schema
-- Run this in the Supabase SQL Editor or via `supabase db push`
-- ============================================================

-- 1. User profiles (one row per authenticated user)
CREATE TABLE public.user_profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  interests       TEXT[]      NOT NULL DEFAULT '{}',
  location        TEXT        NOT NULL DEFAULT '',
  budget          TEXT        NOT NULL DEFAULT 'any'
                              CHECK (budget IN ('free', 'under50', 'under200', 'any')),
  format_preferences TEXT[]   NOT NULL DEFAULT '{}',
  goal            TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);


-- 2. Saved / bookmarked events (per user)
CREATE TABLE public.saved_events (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id   TEXT        NOT NULL,
  event_data JSONB       NOT NULL,
  notes      TEXT        NOT NULL DEFAULT '',
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved events"
  ON public.saved_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved events"
  ON public.saved_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved events"
  ON public.saved_events FOR DELETE
  USING (auth.uid() = user_id);
