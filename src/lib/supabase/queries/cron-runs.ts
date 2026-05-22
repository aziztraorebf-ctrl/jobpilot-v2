import { getSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

export interface CronRunRecord {
  route: string;
  success: boolean;
  duration_ms?: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CronRunSummary {
  route: string;
  ran_at: string;
  success: boolean;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Persist a cron execution result. Best-effort: errors are logged but
 * never thrown, so observability writes never break the cron itself.
 */
export async function insertCronRun(record: CronRunRecord): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("cron_runs").insert({
      route: record.route,
      success: record.success,
      duration_ms: record.duration_ms ?? null,
      error_message: record.error_message ?? null,
      metadata: (record.metadata ?? {}) as Json,
    });
    if (error) {
      console.error("[cron_runs] insert failed:", error.message);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron_runs] insert threw:", msg);
  }
}

/**
 * Read the most recent run for each cron route. Used by /api/health
 * to report cron status without external API calls.
 */
export async function getLatestCronRuns(): Promise<CronRunSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cron_runs")
    .select("route, ran_at, success, duration_ms, error_message, metadata")
    .order("ran_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[cron_runs] read failed:", error.message);
    return [];
  }

  const seen = new Set<string>();
  const latest: CronRunSummary[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.route)) continue;
    seen.add(row.route);
    latest.push({
      ...row,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    });
  }
  return latest;
}
