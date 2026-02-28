"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobList } from "@/components/jobs/job-list";
import { DismissedJobs } from "@/components/jobs/dismissed-jobs";
import type { JobRow } from "@/lib/supabase/queries";

interface JobsPageClientProps {
  initialJobs: JobRow[];
  initialScoreMap: Record<string, number>;
  initialDismissedIds: string[];
  initialDismissedJobs: JobRow[];
  initialSeenIds: string[];
  title: string;
}

export function JobsPageClient({
  initialJobs,
  initialScoreMap,
  initialDismissedIds,
  initialDismissedJobs,
  initialSeenIds,
  title,
}: JobsPageClientProps) {
  const t = useTranslations("jobs");

  const [dismissedJobs, setDismissedJobs] = useState<JobRow[]>(initialDismissedJobs);
  const [dismissedIds, setDismissedIds] = useState<string[]>(initialDismissedIds);

  // Called when a job is dismissed from the active list
  const handleJobDismissed = useCallback((jobId: string, job: JobRow) => {
    setDismissedIds((prev) => [...prev, jobId]);
    setDismissedJobs((prev) => [job, ...prev]);
  }, []);

  // Called when a job is restored from the dismissed list
  const handleJobRestored = useCallback((jobId: string) => {
    setDismissedIds((prev) => prev.filter((id) => id !== jobId));
    setDismissedJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t("active")}</TabsTrigger>
          <TabsTrigger value="dismissed">
            {t("dismissed")} ({dismissedJobs.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <JobList
            initialJobs={initialJobs}
            initialScoreMap={initialScoreMap}
            initialDismissedIds={dismissedIds}
            initialSeenIds={initialSeenIds}
            onJobDismissed={handleJobDismissed}
          />
        </TabsContent>
        <TabsContent value="dismissed" className="mt-4">
          <DismissedJobs
            initialJobs={dismissedJobs}
            onJobRestored={handleJobRestored}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
