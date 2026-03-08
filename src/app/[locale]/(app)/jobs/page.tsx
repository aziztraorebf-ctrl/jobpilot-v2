import { getTranslations } from "next-intl/server";
import { JobsPageClient } from "@/components/jobs/jobs-page-client";
import { getJobs, getScoreMap, getDismissedJobIds, getDismissedJobs, getSeenJobIds, getManualSearchStatus } from "@/lib/supabase/queries";
import { getProfile } from "@/lib/supabase/queries/profiles";
import { getJobIdsByResumeId } from "@/lib/supabase/queries/scores";
import { requireUser } from "@/lib/supabase/get-user";

export default async function JobsPage() {
  const t = await getTranslations("jobs");
  const user = await requireUser();

  let jobs: Awaited<ReturnType<typeof getJobs>> = [];
  let dismissedIds: string[] = [];
  let dismissedJobs: Awaited<ReturnType<typeof getDismissedJobs>> = [];
  let seenIds: { id: string; seen_at: string }[] = [];

  try {
    [jobs, dismissedIds, dismissedJobs, seenIds] = await Promise.all([
      getJobs({ inbox: true, userId: user.id }),
      getDismissedJobIds(user.id),
      getDismissedJobs(user.id),
      getSeenJobIds(user.id),
    ]);
  } catch (error) {
    console.error("[JobsPage] Failed to fetch data:", error);
  }

  let scoreMap: Record<string, number> = {};
  try {
    const jobIds = jobs.map((j) => j.id);
    scoreMap = jobIds.length > 0 ? await getScoreMap(user.id, jobIds) : {};
  } catch (error) {
    console.error("[JobsPage] Failed to fetch scores:", error);
  }

  // Sort by score descending, keep top 25 — best matches first, not most recent
  jobs = [...jobs]
    .sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
    .slice(0, 25);

  let remainingSearches = 3;
  try {
    const searchStatus = await getManualSearchStatus(user.id);
    remainingSearches = searchStatus.remaining;
  } catch {
    // default to 3 on error
  }

  // Compute rotation profiles and job IDs per profile for client-side filtering
  interface RotationProfileEntry {
    resume_id: string | null;
    keywords: string[];
    label: string;
  }
  let rotationProfiles: RotationProfileEntry[] | null = null;
  let jobIdsByResumeId: Record<string, string[]> = {};

  try {
    const profile = await getProfile(user.id);
    const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
    const profiles = prefs.rotation_profiles as RotationProfileEntry[] | undefined;
    if (profiles && profiles.length >= 2) {
      rotationProfiles = profiles;
      // Pre-compute job IDs for each profile that has a resume_id
      const resumeIds = profiles
        .map((p) => p.resume_id)
        .filter((id): id is string => id !== null);
      const results = await Promise.all(
        resumeIds.map((rid) => getJobIdsByResumeId(user.id, rid).catch(() => []))
      );
      resumeIds.forEach((rid, i) => {
        jobIdsByResumeId[rid] = results[i];
      });
    }
  } catch (error) {
    console.error("[JobsPage] Failed to fetch rotation profiles:", error);
  }

  return (
    <JobsPageClient
      initialJobs={jobs}
      initialScoreMap={scoreMap}
      initialDismissedIds={dismissedIds}
      initialDismissedJobs={dismissedJobs}
      initialSeenIds={seenIds}
      title={t("title")}
      initialRemainingSearches={remainingSearches}
      rotationProfiles={rotationProfiles}
      jobIdsByResumeId={jobIdsByResumeId}
    />
  );
}
