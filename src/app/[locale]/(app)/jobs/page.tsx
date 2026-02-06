import { getTranslations } from "next-intl/server";
import { JobList } from "@/components/jobs/job-list";
import { getJobs, getScoreMap, getDismissedJobIds } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";

export default async function JobsPage() {
  const t = await getTranslations("jobs");
  const user = await requireUser();

  let jobs: Awaited<ReturnType<typeof getJobs>>;
  let dismissedIds: string[];

  try {
    [jobs, dismissedIds] = await Promise.all([
      getJobs(),
      getDismissedJobIds(user.id),
    ]);
  } catch (error) {
    console.error("[JobsPage] Failed to fetch data:", error);
    jobs = [];
    dismissedIds = [];
  }

  let scoreMap: Record<string, number> = {};
  try {
    const jobIds = jobs.map((j) => j.id);
    scoreMap = jobIds.length > 0 ? await getScoreMap(user.id, jobIds) : {};
  } catch (error) {
    console.error("[JobsPage] Failed to fetch scores:", error);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <JobList
        initialJobs={jobs}
        initialScoreMap={scoreMap}
        initialDismissedIds={dismissedIds}
      />
    </div>
  );
}
