import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bookmark, ExternalLink, X, MapPin, DollarSign, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreCircle } from "@/components/ui/score-circle";
import { cn } from "@/lib/utils";
import type { UnifiedJob } from "@/lib/schemas/job";
import type { JobRow } from "@/lib/supabase/queries";

interface JobCardProps {
  job: JobRow | UnifiedJob;
  score: number;
  isSeen?: boolean;
  onBookmark?: (jobId: string) => void;
  onDismiss?: (jobId: string) => void;
  onScoreClick?: (jobId: string) => void;
  onCoverLetterClick?: (jobId: string) => void;
}

function getRelativeDays(dateString: string | null): number | null {
  if (!dateString) return null;
  const posted = new Date(dateString);
  if (isNaN(posted.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string
): string | null {
  if (min === null && max === null) return null;

  const formatter = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
    maximumFractionDigits: 0,
  });

  if (min !== null && max !== null) {
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  }
  if (min !== null) {
    return `${formatter.format(min)}+`;
  }
  return formatter.format(max as number);
}

function getRemoteBadgeClasses(
  remoteType: "onsite" | "hybrid" | "remote" | "unknown"
): string {
  switch (remoteType) {
    case "remote":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
    case "hybrid":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "onsite":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function getRemoteKey(
  remoteType: "onsite" | "hybrid" | "remote" | "unknown"
): string {
  switch (remoteType) {
    case "remote":
      return "remote";
    case "hybrid":
      return "hybrid";
    case "onsite":
      return "onsite";
    default:
      return "unknown";
  }
}

function getSourceBadgeClasses(source: string): string {
  switch (source) {
    case "jsearch":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "adzuna":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "jsearch":
      return "JSearch";
    case "adzuna":
      return "Adzuna";
    default:
      return source;
  }
}

export function JobCard({ job, score, isSeen, onBookmark, onDismiss, onScoreClick, onCoverLetterClick }: JobCardProps) {
  const t = useTranslations("jobs");
  const jobId = "id" in job ? String((job as Record<string, unknown>).id) : "";
  const days = getRelativeDays(job.posted_at);
  const salaryText = formatSalary(
    job.salary_min,
    job.salary_max,
    job.salary_currency
  );

  function handleApply() {
    if (job.source_url) {
      window.open(job.source_url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow py-4",
      isSeen && "opacity-75 border-l-4 border-l-muted-foreground/30"
    )}>
      <CardContent className="space-y-3">
        {/* Top section: title + actions */}
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold leading-tight truncate">
                {job.title}
              </h3>
              {!isSeen && (
                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-transparent shrink-0">
                  New
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {job.company_name ?? t("unknownCompany")}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("bookmark")}
              title={t("bookmark")}
              onClick={() => onBookmark?.(jobId)}
            >
              <Bookmark className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("apply")}
              title={t("apply")}
              onClick={handleApply}
            >
              <ExternalLink className="size-4" />
            </Button>
            {onCoverLetterClick && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("coverLetter")}
                title={t("coverLetter")}
                onClick={() => onCoverLetterClick(jobId)}
              >
                <FileText className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("dismiss")}
              title={t("dismiss")}
              onClick={() => onDismiss?.(jobId)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Bottom section: metadata badges */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Location */}
          {job.location && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="size-3" />
              {job.location}
            </Badge>
          )}

          {/* Salary */}
          {salaryText && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="size-3" />
              {salaryText}
            </Badge>
          )}

          {/* Score circle */}
          {score > 0 && onScoreClick ? (
            <button
              type="button"
              className="cursor-pointer"
              title={t("scoreDetail")}
              onClick={() => onScoreClick(jobId)}
            >
              <ScoreCircle score={score} size="md" />
            </button>
          ) : (
            <ScoreCircle score={score} size="md" />
          )}

          {/* Source badge */}
          <Badge
            className={cn(
              "border-transparent",
              getSourceBadgeClasses(job.source)
            )}
          >
            {getSourceLabel(job.source)}
          </Badge>

          {/* Remote type badge */}
          <Badge
            className={cn(
              "border-transparent",
              getRemoteBadgeClasses(job.remote_type)
            )}
          >
            {t(getRemoteKey(job.remote_type))}
          </Badge>

          {/* Posted date */}
          {days !== null && (
            <span className="text-xs text-muted-foreground">
              {days === 0 ? t("today") : t("daysAgo", { count: days })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
