-- cron_runs: persist each cron execution result for observability.
-- Lets the /api/health endpoint report when each cron last ran successfully,
-- and provides an audit trail for silent failures.

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  duration_ms integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_route_ran_at
  ON public.cron_runs (route, ran_at DESC);
