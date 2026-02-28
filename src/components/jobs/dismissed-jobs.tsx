"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { JobRow } from "@/lib/supabase/queries";

interface DismissedJobsProps {
  initialJobs: JobRow[];
  onJobRestored?: (jobId: string) => void;
}

export function DismissedJobs({ initialJobs, onJobRestored }: DismissedJobsProps) {
  const t = useTranslations("jobs");
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs);

  // Sync when parent updates the list (e.g. a new job is dismissed from the active tab)
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const handleRestore = useCallback(async (jobId: string) => {
    const previousJobs = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== jobId));

    try {
      const res = await fetch("/api/jobs/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobListingId: jobId }),
      });
      if (!res.ok) throw new Error("Restore failed");
      onJobRestored?.(jobId);
      toast.success(t("jobRestored"));
    } catch {
      setJobs(previousJobs);
      toast.error(t("actionFailed"));
    }
  }, [jobs, onJobRestored, t]);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("noDismissedJobs")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardContent className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{job.title}</p>
              <p className="text-xs text-muted-foreground">
                {job.company_name ?? t("unknownCompany")}
              </p>
              {job.location && (
                <Badge variant="outline" className="mt-1 gap-1 text-xs">
                  <MapPin className="size-3" />
                  {job.location}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(job.id)}
              className="shrink-0 gap-1"
            >
              <RotateCcw className="size-3" />
              {t("restore")}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
