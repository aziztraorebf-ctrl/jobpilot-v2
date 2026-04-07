// src/app/api/cron/fetch-jobs/route.ts
import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { getSupabase } from "@/lib/supabase/client";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { deduplicateJobs } from "@/lib/services/deduplicator";
import { upsertJobs, getProfilesWithAutoSearch, markJobSeen } from "@/lib/supabase/queries";
import { updateProfile } from "@/lib/supabase/queries/profiles";
import { sendEmail } from "@/lib/services/email-service";
import { render } from "@react-email/components";
import { NewJobsAlert } from "@/emails/new-jobs-alert";
import { buildSearchQueries, nextRotationIndex } from "@/lib/utils/search-query-builder";
import { getActiveSearchProfile, shouldRotate, getNextRotationIndex } from "@/lib/utils/search-profile-helpers";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";
import { MIN_DISPLAY_SCORE } from "@/lib/config/scoring";
import type { UnifiedJob } from "@/lib/schemas/job";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ message: "No profiles with auto-search", fetched: 0 });
    }

    let totalInserted = 0;
    const supabase = getSupabase();

    for (const profile of profiles) {
      try {
        const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
        const locations = (prefs.locations as string[] | undefined) ?? [];
        const threshold = (prefs.alert_threshold as number | undefined) ?? 60;

        // Auto-rotate profile if conditions are met (optimistic: best-effort, no strict locking needed for single-user app)
        let currentPrefs = prefs;
        if (shouldRotate(currentPrefs)) {
          const profileArr = currentPrefs.rotation_profiles as unknown[] | undefined;
          const currentIndex = typeof currentPrefs.active_profile_index === "number"
            ? currentPrefs.active_profile_index : 0;
          const nextIndex = getNextRotationIndex(currentIndex, (profileArr ?? []).length);
          const rotatedPrefs = {
            ...currentPrefs,
            active_profile_index: nextIndex,
            last_rotation_at: new Date().toISOString(),
          };
          await updateProfile(profile.id, { search_preferences: rotatedPrefs });
          currentPrefs = rotatedPrefs;
        }

        // Log unseen count for monitoring (no longer blocks fetching)
        const { count: unseenCount } = await supabase
          .from("job_listings")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .not("id", "in",
            supabase.from("seen_jobs").select("job_listing_id").eq("user_id", profile.id)
          );
        console.log(`[Cron fetch-jobs] Profile ${profile.id} unseen jobs: ${unseenCount}`);

        const activeProfile = getActiveSearchProfile(currentPrefs);
        const keywords = activeProfile.keywords;
        const rotationIndex = (currentPrefs.keyword_rotation_index as number | undefined) ?? 0;

        if (keywords.length === 0) continue;

        const activeKeywords = buildSearchQueries(keywords, rotationIndex);
        const location = locations[0] ?? "Canada";

        const allJobs: UnifiedJob[] = [];
        for (const query of activeKeywords) {
          const result = await aggregateJobSearch({ keywords: query, location, sources: ["jsearch", "adzuna", "tavily"] });
          allJobs.push(...result.jobs);
        }

        const uniqueJobs = deduplicateJobs(allJobs);

        // Always advance rotation index, even if no results
        const newIndex = nextRotationIndex(keywords, rotationIndex);
        await updateProfile(profile.id, {
          search_preferences: { ...currentPrefs, keyword_rotation_index: newIndex },
        });

        if (uniqueJobs.length === 0) continue;

        // Tag each job with the active profile label for tracking.
        // ignoreDuplicates=true means existing jobs keep their original profile_label (first-fetch wins).
        const taggedJobs = uniqueJobs.map((job) => ({
          ...job,
          profile_label: activeProfile.label || null,
        }));

        const inserted = await upsertJobs(taggedJobs);
        totalInserted += inserted.length;

        if (inserted.length === 0) continue;

        // Auto-score all inserted jobs against the active rotation profile's resume (or primary)
        const activeResumeId = activeProfile.resumeId ?? undefined;
        const jobsToScore = inserted.map((j) => ({
          id: j.id,
          description: j.description,
          title: j.title,
        }));
        const scores = await scoreJobsForProfile(profile.id, jobsToScore, activeResumeId);

        // Deactivate jobs below MIN_DISPLAY_SCORE (only when scoring produced results;
        // if scores is empty — no CV or total failure — keep all jobs active)
        if (Object.keys(scores).length > 0) {
          const belowThresholdIds = inserted
            .filter((j) => (scores[j.id] ?? 0) < MIN_DISPLAY_SCORE)
            .map((j) => j.id);

          if (belowThresholdIds.length > 0) {
            const { error: deactivateError } = await supabase
              .from("job_listings")
              .update({ is_active: false })
              .in("id", belowThresholdIds);
            if (deactivateError) {
              console.error("[Cron fetch-jobs] Failed to deactivate low-score jobs:", deactivateError.message);
            }
          }
        }

        // Auto-mark all scored jobs as "seen" so they cycle out of the inbox
        const scoredJobIds = Object.keys(scores);
        for (const jobId of scoredJobIds) {
          try {
            await markJobSeen(profile.id, jobId);
          } catch {
            // Non-blocking: seen tracking is best-effort
          }
        }

        // Send email alert for jobs above alert_threshold
        const highScoreJobs = inserted
          .filter((j) => (scores[j.id] ?? 0) >= threshold)
          .map((j) => ({
            title: j.title,
            company: j.company_name ?? "Unknown",
            location: j.location,
            score: scores[j.id] ?? 0,
            sourceUrl: j.source_url,
            description: j.description,
          }));

        if (highScoreJobs.length > 0) {
          const html = await render(
            NewJobsAlert({
              jobs: highScoreJobs,
              threshold,
              date: new Date().toISOString().split("T")[0],
              keywords: activeKeywords,
            })
          );

          await sendEmail({
            subject: `[JobPilot] ${highScoreJobs.length} nouvelle(s) offre(s) correspondante(s)`,
            html,
          });
        }
      } catch (profileError: unknown) {
        const msg = profileError instanceof Error ? profileError.message : String(profileError);
        console.error(`[Cron fetch-jobs] Profile ${profile.id} failed:`, msg);
      }
    }

    return NextResponse.json({ message: "Cron completed", fetched: totalInserted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron fetch-jobs]", message);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
