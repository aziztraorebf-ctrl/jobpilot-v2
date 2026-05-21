import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { expireOldJobs } from "@/lib/supabase/queries/jobs";
import { insertCronRun } from "@/lib/supabase/queries";

const ROUTE = "/api/cron/expire-jobs";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  const startedAt = Date.now();
  try {
    const result = await expireOldJobs();
    console.log(`[Cron expire-jobs] Expired ${result.expired} job listings`);
    await insertCronRun({
      route: ROUTE,
      success: true,
      duration_ms: Date.now() - startedAt,
      metadata: { expired: result.expired },
    });
    return NextResponse.json({ message: "Expiry complete", expired: result.expired });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron expire-jobs]", message);
    Sentry.captureException(error, { tags: { cron: "expire-jobs" } });
    await insertCronRun({
      route: ROUTE,
      success: false,
      duration_ms: Date.now() - startedAt,
      error_message: message,
    });
    return NextResponse.json({ error: "Expiry failed" }, { status: 500 });
  }
}
