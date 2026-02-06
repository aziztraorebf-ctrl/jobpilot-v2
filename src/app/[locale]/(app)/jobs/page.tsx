import { getTranslations } from "next-intl/server";
import { JobList } from "@/components/jobs/job-list";
import { DismissedJobs } from "@/components/jobs/dismissed-jobs";
import { getJobs, getScoreMap, getDismissedJobIds, getDismissedJobs } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function JobsPage() {
  const t = await getTranslations("jobs");
  const user = await requireUser();

  let jobs: Awaited<ReturnType<typeof getJobs>> = [];
  let dismissedIds: string[] = [];
  let dismissedJobs: Awaited<ReturnType<typeof getDismissedJobs>> = [];

  try {
    [jobs, dismissedIds, dismissedJobs] = await Promise.all([
      getJobs(),
      getDismissedJobIds(user.id),
      getDismissedJobs(user.id),
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t("active")}</TabsTrigger>
          <TabsTrigger value="dismissed">
            {t("dismissed")} ({dismissedJobs.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <JobList
            initialJobs={jobs}
            initialScoreMap={scoreMap}
            initialDismissedIds={dismissedIds}
          />
        </TabsContent>
        <TabsContent value="dismissed" className="mt-4">
          <DismissedJobs initialJobs={dismissedJobs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
