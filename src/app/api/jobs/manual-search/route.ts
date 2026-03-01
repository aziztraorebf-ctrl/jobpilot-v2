import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/get-user";
import { getProfile, incrementManualSearch } from "@/lib/supabase/queries/profiles";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { upsertJobs } from "@/lib/supabase/queries/jobs";
import { apiError } from "@/lib/api/error-response";

export async function POST(_request: Request) {
  try {
    const user = await requireUser();

    // Check and increment counter (throws if limit reached)
    let status;
    try {
      status = await incrementManualSearch(user.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "MANUAL_SEARCH_LIMIT_REACHED") {
        return NextResponse.json(
          { error: "MANUAL_SEARCH_LIMIT_REACHED", remaining: 0 },
          { status: 429 }
        );
      }
      throw err;
    }

    // Get user preferences
    const profile = await getProfile(user.id);
    const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
    const keywords = (prefs.keywords as string[] | undefined) ?? [];
    const locations = (prefs.locations as string[] | undefined) ?? [];

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "NO_KEYWORDS", fetched: 0, remaining: status.remaining },
        { status: 400 }
      );
    }

    const query = keywords.join(" ");
    const location = locations[0] ?? "Canada";

    const result = await aggregateJobSearch({ keywords: query, location });
    const inserted = await upsertJobs(result.jobs);

    revalidatePath("/[locale]/(app)/jobs", "page");

    return NextResponse.json({
      fetched: inserted.length,
      remaining: status.remaining,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/jobs/manual-search");
  }
}
