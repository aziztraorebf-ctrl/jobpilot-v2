import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/get-user";
import { getLatestScoreForJob } from "@/lib/supabase/queries/scores";
import { apiError } from "@/lib/api/error-response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "jobId query parameter is required" },
        { status: 400 }
      );
    }

    const score = await getLatestScoreForJob(user.id, jobId);

    if (!score) {
      return NextResponse.json(null);
    }

    return NextResponse.json(score);
  } catch (error: unknown) {
    return apiError(error, "GET /api/ai/match-score-detail");
  }
}
