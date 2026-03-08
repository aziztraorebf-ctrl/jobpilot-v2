"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobList } from "@/components/jobs/job-list";
import { DismissedJobs } from "@/components/jobs/dismissed-jobs";
import type { JobRow } from "@/lib/supabase/queries";
import { toast } from "sonner";
import { RefreshCw, Loader2, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobsPageClientProps {
  initialJobs: JobRow[];
  initialScoreMap: Record<string, number>;
  initialDismissedIds: string[];
  initialDismissedJobs: JobRow[];
  initialSeenIds: { id: string; seen_at: string }[];
  title: string;
  initialRemainingSearches: number;
  rotationProfiles: Array<{ resume_id: string | null; keywords: string[]; label: string }> | null;
  jobIdsByResumeId: Record<string, string[]>;
}

export function JobsPageClient({
  initialJobs,
  initialScoreMap,
  initialDismissedIds,
  initialDismissedJobs,
  initialSeenIds,
  title,
  initialRemainingSearches,
  rotationProfiles,
  jobIdsByResumeId,
}: JobsPageClientProps) {
  const t = useTranslations("jobs");

  const [dismissedJobs, setDismissedJobs] = useState<JobRow[]>(initialDismissedJobs);
  const [dismissedIds, setDismissedIds] = useState<string[]>(initialDismissedIds);
  const [remaining, setRemaining] = useState(initialRemainingSearches);
  const [isSearching, setIsSearching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(initialScoreMap);
  const [activeProfileFilter, setActiveProfileFilter] = useState<string | "all">("all");
  const [visibleCount, setVisibleCount] = useState(15);

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

  const handleManualSearch = useCallback(async () => {
    setIsSearching(true);
    try {
      const res = await fetch("/api/jobs/manual-search", { method: "POST" });
      const body = await res.json();
      if (res.status === 429) {
        toast.error(t("searchLimitReached"));
        setRemaining(0);
        return;
      }
      if (res.status === 400 && body.error === "NO_KEYWORDS") {
        toast.error(t("searchNoKeywords"));
        return;
      }
      if (!res.ok) {
        toast.error(t("actionFailed"));
        return;
      }
      setRemaining(body.remaining);
      toast.success(t("searchDone", { count: body.fetched }));
      window.location.reload();
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  const handleScoreJobs = useCallback(async () => {
    setIsScoring(true);
    try {
      const res = await fetch("/api/ai/score-jobs", { method: "POST" });
      const body = await res.json();
      if (res.status === 400 && body.error === "NO_RESUME") {
        toast.error(t("scoreNoResume"));
        return;
      }
      if (res.status === 400 && body.error === "RESUME_NOT_ANALYZED") {
        toast.error(t("scoreResumeNotAnalyzed"));
        return;
      }
      if (!res.ok) {
        toast.error(t("actionFailed"));
        return;
      }
      if (body.scored === 0) {
        toast.info(t("scoreAllDone"));
        return;
      }
      setScoreMap((prev) => ({ ...prev, ...body.newScores }));
      toast.success(t("scoreDone", { count: body.scored }));
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setIsScoring(false);
    }
  }, [t]);

  const handleExportCsv = useCallback(() => {
    const params = new URLSearchParams({ days: "30", minScore: "0" });
    if (activeProfileFilter !== "all" && rotationProfiles) {
      const profile = rotationProfiles.find((_p, i) => `profile-${i}` === activeProfileFilter);
      if (profile) params.set("profile", profile.label);
    }
    window.open(`/api/jobs/export?${params}`, "_blank");
  }, [activeProfileFilter, rotationProfiles]);

  const handleProfileFilterChange = useCallback((value: string) => {
    setActiveProfileFilter(value);
    setVisibleCount(15);
  }, []);

  // Filter jobs by active profile when a profile tab is selected
  const allFilteredJobs = activeProfileFilter === "all" || !rotationProfiles
    ? initialJobs
    : initialJobs.filter((job) => {
        const profile = rotationProfiles!.find(
          (_p, i) => `profile-${i}` === activeProfileFilter
        );
        if (!profile || !profile.resume_id) return false;
        const ids = jobIdsByResumeId[profile.resume_id] ?? [];
        return ids.includes(job.id);
      });

  const totalFiltered = allFilteredJobs.length;
  const filteredJobs = allFilteredJobs.slice(0, visibleCount);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} title="Exporter en CSV">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Exporter</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScoreJobs}
              disabled={isScoring || isSearching}
              className="gap-2"
            >
              {isScoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isScoring ? t("scoring") : t("scoreNow")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSearch}
              disabled={isSearching || isScoring || remaining === 0}
              className="gap-2"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSearching ? t("searching") : t("searchNow")}
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            {t("remainingSearches", { count: remaining })}
          </span>
        </div>
      </div>
      {rotationProfiles && rotationProfiles.length >= 2 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleProfileFilterChange("all")}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              activeProfileFilter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {t("all")}
          </button>
          {rotationProfiles.map((profile, i) => (
            <button
              type="button"
              key={`profile-${i}`}
              onClick={() => handleProfileFilterChange(`profile-${i}`)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                activeProfileFilter === `profile-${i}`
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {profile.label}
            </button>
          ))}
        </div>
      )}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t("active")}</TabsTrigger>
          <TabsTrigger value="dismissed">
            {t("dismissed")} ({dismissedJobs.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <JobList
            initialJobs={filteredJobs}
            initialScoreMap={scoreMap}
            initialDismissedIds={dismissedIds}
            initialSeenIds={initialSeenIds}
            onJobDismissed={handleJobDismissed}
          />
          {visibleCount < totalFiltered && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + 10)}
              >
                Charger plus ({totalFiltered - visibleCount} restants)
              </Button>
            </div>
          )}
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
