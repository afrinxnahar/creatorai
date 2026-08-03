-- Admin observability: live user presence + a single funnel for every user-facing error.
--
-- 1. profiles.last_seen_at  — stamped by the API auth guard, so "online now" is
--    "made an authenticated API call in the last N minutes".
-- 2. error_logs             — every API exception and worker job failure, with the
--    stack and request context the job tables never captured.

-- == 1. PRESENCE ==

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Partial index: presence queries only ever look at recent, non-null rows.
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON public.profiles USING btree (last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

-- == 2. ERROR LOGS ==

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Stable hash of source + error name + normalized message + route. Groups the
  -- same bug across users so alerting can dedupe on it.
  fingerprint text NOT NULL,
  source text NOT NULL,
  feature text,
  user_id uuid,
  name text,
  message text NOT NULL,
  stack text,
  route text,
  method text,
  status_code integer,
  context jsonb NOT NULL DEFAULT '{}',
  -- Set when an alert email went out for this row; drives the per-fingerprint
  -- cooldown so one bad deploy sends one email, not ten thousand.
  alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT error_logs_source_check CHECK (source IN ('api', 'worker')),
  CONSTRAINT error_logs_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON public.error_logs USING btree (fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_feature ON public.error_logs USING btree (feature, created_at DESC);
-- Cooldown lookup: "was this fingerprint alerted recently?"
CREATE INDEX IF NOT EXISTS idx_error_logs_alerted
  ON public.error_logs USING btree (fingerprint, alerted_at DESC)
  WHERE alerted_at IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'error_logs' AND policyname = 'Admins can view error logs'
  ) THEN
    CREATE POLICY "Admins can view error logs"
      ON public.error_logs FOR SELECT TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'error_logs' AND policyname = 'Allow service role full access error_logs'
  ) THEN
    CREATE POLICY "Allow service role full access error_logs"
      ON "public"."error_logs" AS permissive FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
