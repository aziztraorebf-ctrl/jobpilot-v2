"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreCircle } from "@/components/ui/score-circle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
} from "@/lib/supabase/queries";
import type { ApplicationWithJob, ApplicationStatus } from "@/lib/supabase/queries";

const STATUS_COLORS: Record<string, string> = {
  saved: "text-slate-600 dark:text-slate-400",
  applying: "text-sky-600 dark:text-sky-400",
  applied: "text-blue-600 dark:text-blue-400",
  interview: "text-purple-600 dark:text-purple-400",
  offer: "text-emerald-600 dark:text-emerald-400",
  accepted: "text-green-600 dark:text-green-400",
  rejected: "text-red-600 dark:text-red-400",
  withdrawn: "text-gray-600 dark:text-gray-400",
};

const STATUS_OPTIONS: readonly ApplicationStatus[] = APPLICATION_STATUSES;

interface ListViewProps {
  applications: ApplicationWithJob[];
  scoreMap: Record<string, number>;
}

function getRelevantDate(application: ApplicationWithJob): string {
  const dateStr =
    application.interview_at ?? application.applied_at ?? application.saved_at;
  if (!dateStr) {
    return "";
  }
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export function ListView({
  applications: initialApplications,
  scoreMap,
}: ListViewProps) {
  const t = useTranslations("applications");
  const [applications, setApplications] =
    useState<ApplicationWithJob[]>(initialApplications);

  const handleStatusChange = useCallback(
    async (id: string, newStatus: ApplicationStatus) => {
      // Optimistic update: apply immediately
      const previousApplications = applications;
      setApplications((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, status: newStatus } : app
        )
      );

      try {
        const response = await fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          setApplications(previousApplications);
          toast.error(t("statusUpdateFailed"));
        } else {
          toast.success(t("statusUpdated"));
        }
      } catch {
        setApplications(previousApplications);
        toast.error(t("statusUpdateFailed"));
      }
    },
    [applications]
  );

  return (
    <div className="w-full">
      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-x-auto">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_0.5fr_1fr] gap-4 p-3 bg-muted rounded-t-lg font-semibold text-sm min-w-[600px]">
          <span>{t("job")}</span>
          <span>{t("company")}</span>
          <span>{t("status")}</span>
          <span>{t("score")}</span>
          <span>{t("date")}</span>
        </div>

        {applications.map((application) => {
          const jobTitle = application.job_listings?.title ?? "Untitled";
          const company = application.job_listings?.company_name ?? "Unknown";
          const score = scoreMap[application.job_listing_id] ?? null;

          return (
            <div
              key={application.id}
              className="grid grid-cols-[2fr_1.5fr_1fr_0.5fr_1fr] gap-4 p-3 border-b items-center min-w-[600px]"
            >
              <span className="font-medium text-sm truncate">
                {jobTitle}
              </span>
              <span className="text-sm text-muted-foreground truncate">
                {company}
              </span>
              <div>
                <Select
                  value={application.status}
                  onValueChange={(value: string) =>
                    handleStatusChange(
                      application.id,
                      value as ApplicationStatus
                    )
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className={cn("text-xs", STATUS_COLORS[application.status])}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className={cn("text-xs", STATUS_COLORS[status])}
                      >
                        {t(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {score !== null ? (
                <ScoreCircle score={score} size="sm" />
              ) : (
                <span className="text-xs text-muted-foreground">--</span>
              )}
              <span className="text-sm text-muted-foreground">
                {getRelevantDate(application)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden space-y-3">
        {applications.map((application) => {
          const jobTitle = application.job_listings?.title ?? "Untitled";
          const company = application.job_listings?.company_name ?? "Unknown";
          const score = scoreMap[application.job_listing_id] ?? null;

          return (
            <div
              key={application.id}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {jobTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {company}
                  </p>
                </div>
                {score !== null ? (
                  <ScoreCircle score={score} size="sm" />
                ) : (
                  <span className="text-xs text-muted-foreground">--</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={application.status}
                  onValueChange={(value: string) =>
                    handleStatusChange(
                      application.id,
                      value as ApplicationStatus
                    )
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className={cn("text-xs w-[140px]", STATUS_COLORS[application.status])}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className={cn("text-xs", STATUS_COLORS[status])}
                      >
                        {t(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {getRelevantDate(application)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
