"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobCard } from "@/components/jobs/job-card";
import { toast } from "sonner";
import type { JobRow } from "@/lib/supabase/queries";

interface Filters {
  search: string;
  source: string;
  remote: string;
  minScore: number;
}

interface JobListProps {
  initialJobs: JobRow[];
  initialScoreMap: Record<string, number>;
  initialDismissedIds: string[];
}

export function JobList({
  initialJobs,
  initialScoreMap,
  initialDismissedIds,
}: JobListProps) {
  const t = useTranslations("jobs");
  const [filters, setFilters] = useState<Filters>({
    search: "",
    source: "all",
    remote: "all",
    minScore: 0,
  });

  // Build a Set for O(1) dismissed lookups - use state for optimistic updates
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set(initialDismissedIds)
  );

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
  }, []);

  const handleDismiss = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setDismissedIds((prev) => new Set(prev).add(jobId));
    try {
      const res = await fetch("/api/jobs/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobListingId: jobId }),
      });
      if (!res.ok) throw new Error("Dismiss failed");
      toast.success(t("jobDismissed"));
    } catch {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      toast.error(t("actionFailed"));
    }
  }, [t]);

  const handleBookmark = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setDismissedIds((prev) => new Set(prev).add(jobId));
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobListingId: jobId }),
      });
      if (!res.ok) throw new Error("Bookmark failed");
      toast.success(t("jobSaved"));
    } catch {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      toast.error(t("actionFailed"));
    }
  }, [t]);

  const filteredJobs = useMemo(() => {
    const searchLower = filters.search.toLowerCase();

    return initialJobs
      .filter((job) => {
        // Exclude dismissed jobs
        if (dismissedIds.has(job.id)) {
          return false;
        }

        // Search filter: match title or company_name
        if (searchLower) {
          const titleMatch = job.title.toLowerCase().includes(searchLower);
          const companyMatch =
            job.company_name?.toLowerCase().includes(searchLower) ?? false;
          if (!titleMatch && !companyMatch) return false;
        }

        // Source filter
        if (filters.source !== "all" && job.source !== filters.source) {
          return false;
        }

        // Remote filter
        if (filters.remote === "yes" && job.remote_type !== "remote") {
          return false;
        }
        if (filters.remote === "no" && job.remote_type === "remote") {
          return false;
        }

        // Min score filter
        const jobScore = initialScoreMap[job.id] ?? 0;
        if (jobScore < filters.minScore) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const scoreA = initialScoreMap[a.id] ?? 0;
        const scoreB = initialScoreMap[b.id] ?? 0;
        return scoreB - scoreA;
      });
  }, [filters, initialJobs, initialScoreMap, dismissedIds]);

  return (
    <div className="space-y-4">
      <JobFilters onFiltersChange={handleFiltersChange} />

      <p className="text-sm text-muted-foreground">
        {t("jobsFound", { count: filteredJobs.length })}
      </p>

      {filteredJobs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t("noJobsFound")}
        </div>
      )}

      {filteredJobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          score={initialScoreMap[job.id] ?? 0}
          onBookmark={handleBookmark}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
