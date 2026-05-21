import { createAuthClient } from "@/lib/supabase/auth-server";
import { getLatestCronRuns } from "@/lib/supabase/queries";
import { NextResponse } from "next/server";

const STALE_THRESHOLD_HOURS = 48;

export async function GET() {
  try {
    const supabase = await createAuthClient();
    await supabase.from("job_listings").select("id").limit(1);

    const latestRuns = await getLatestCronRuns();
    const now = Date.now();
    const cronStatus = latestRuns.map((run) => {
      const ageHours = (now - new Date(run.ran_at).getTime()) / (1000 * 60 * 60);
      const stale = ageHours > STALE_THRESHOLD_HOURS;
      return {
        route: run.route,
        last_ran_at: run.ran_at,
        success: run.success,
        duration_ms: run.duration_ms,
        error_message: run.error_message,
        metadata: run.metadata,
        age_hours: Math.round(ageHours * 10) / 10,
        stale,
      };
    });

    const anyStale = cronStatus.some((c) => c.stale);
    const anyFailed = cronStatus.some((c) => !c.success);

    return NextResponse.json({
      status: anyFailed || anyStale ? "degraded" : "ok",
      db: "ok",
      crons: cronStatus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
