import { NextResponse } from "next/server";
import { expireOldJobs } from "@/lib/supabase/queries/jobs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await expireOldJobs();
    console.log(`[Cron expire-jobs] Expired ${result.expired} job listings`);
    return NextResponse.json({ message: "Expiry complete", expired: result.expired });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron expire-jobs]", message);
    return NextResponse.json({ error: "Expiry failed" }, { status: 500 });
  }
}
