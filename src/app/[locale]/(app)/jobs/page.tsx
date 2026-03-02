import { getTranslations } from "next-intl/server";
import { JobsPageClient } from "@/components/jobs/jobs-page-client";
import { getJobs, getScoreMap, getDismissedJobIds, getDismissedJobs, getSeenJobIds, getManualSearchStatus } from "@/lib/supabase/queries";
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
      getJobs(),
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

  let remainingSearches = 3;
  try {
    const searchStatus = await getManualSearchStatus(user.id);
    remainingSearches = searchStatus.remaining;
  } catch {
    // default to 3 on error
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
    />
  );
}
