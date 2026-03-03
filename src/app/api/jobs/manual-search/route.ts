// src/app/api/jobs/manual-search/route.ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/client";
import { requireUser } from "@/lib/supabase/get-user";
import { getProfile, incrementManualSearch } from "@/lib/supabase/queries/profiles";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { deduplicateJobs } from "@/lib/services/deduplicator";
import { upsertJobs } from "@/lib/supabase/queries/jobs";
import { buildSearchQueries, nextRotationIndex } from "@/lib/utils/search-query-builder";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";
import { updateProfile } from "@/lib/supabase/queries/profiles";
import { apiError } from "@/lib/api/error-response";
import { MIN_DISPLAY_SCORE } from "@/lib/config/scoring";
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

    // Advance rotation index so next search uses different keywords
    const newIndex = nextRotationIndex(keywords, rotationIndex);
    await updateProfile(profile.id, {
      search_preferences: { ...prefs, keyword_rotation_index: newIndex },
    });

    const allJobs: UnifiedJob[] = [];
    for (const query of activeKeywords) {
      const result = await aggregateJobSearch({ keywords: query, location });
      allJobs.push(...result.jobs);
    }

    const uniqueJobs = deduplicateJobs(allJobs);
    const inserted = await upsertJobs(uniqueJobs);

    // Auto-score inserted jobs
    const jobsToScore = inserted.map((j) => ({
      id: j.id,
      description: j.description,
      title: j.title,
    }));
    const scores = await scoreJobsForProfile(user.id, jobsToScore);

    // Deactivate jobs below MIN_DISPLAY_SCORE (only when scoring produced results;
    // if scores is empty — no CV or total failure — keep all jobs active)
    const supabase = getSupabase();
    let belowThresholdIds: string[] = [];
    if (Object.keys(scores).length > 0) {
      belowThresholdIds = inserted
        .filter((j) => (scores[j.id] ?? 0) < MIN_DISPLAY_SCORE)
        .map((j) => j.id);

      if (belowThresholdIds.length > 0) {
        const { error: deactivateError } = await supabase
          .from("job_listings")
          .update({ is_active: false })
          .in("id", belowThresholdIds);
        if (deactivateError) {
          console.error("[manual-search] Failed to deactivate low-score jobs:", deactivateError.message);
        }
      }
    }

    revalidatePath("/[locale]/(app)/jobs", "page");

    return NextResponse.json({
      fetched: inserted.length,
      scored: Object.keys(scores).length,
      displayed: inserted.length - belowThresholdIds.length,
      remaining: status.remaining,
      activeKeywords,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/jobs/manual-search");
  }
}
