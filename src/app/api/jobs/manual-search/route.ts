import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/get-user";
import { getProfile, incrementManualSearch } from "@/lib/supabase/queries/profiles";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { deduplicateJobs } from "@/lib/services/deduplicator";
import { upsertJobs } from "@/lib/supabase/queries/jobs";
import { buildSearchQueries } from "@/lib/utils/search-query-builder";
import { apiError } from "@/lib/api/error-response";
import type { UnifiedJob } from "@/lib/schemas/job";

export async function POST(_request: Request) {
  try {
    const user = await requireUser();

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

    const profile = await getProfile(user.id);
    const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
    const keywords = (prefs.keywords as string[] | undefined) ?? [];
    const locations = (prefs.locations as string[] | undefined) ?? [];
    const rotationIndex = (prefs.keyword_rotation_index as number | undefined) ?? 0;

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "NO_KEYWORDS", fetched: 0, remaining: status.remaining },
        { status: 400 }
      );
    }

    const activeKeywords = buildSearchQueries(keywords, rotationIndex);
    const location = locations[0] ?? "Canada";

    const allJobs: UnifiedJob[] = [];
    for (const query of activeKeywords) {
      const result = await aggregateJobSearch({ keywords: query, location });
      allJobs.push(...result.jobs);
    }

    const uniqueJobs = deduplicateJobs(allJobs);
    const inserted = await upsertJobs(uniqueJobs);

    revalidatePath("/[locale]/(app)/jobs", "page");

    return NextResponse.json({
      fetched: inserted.length,
      remaining: status.remaining,
      activeKeywords,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/jobs/manual-search");
  }
}
