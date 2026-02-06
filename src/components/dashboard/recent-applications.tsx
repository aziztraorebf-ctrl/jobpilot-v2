"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApplicationWithJob, ApplicationStatus } from "@/lib/supabase/queries";

const statusStyles: Record<ApplicationStatus, string> = {
  saved: "",
  applying: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 border-0",
  applied: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0",
  interview:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-0",
  offer:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0",
  accepted:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0",
  rejected:
    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-0",
  withdrawn:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0",
};

/** Type guard: returns true if value is a known ApplicationStatus. */
function isApplicationStatus(value: string): value is ApplicationStatus {
  return value in statusStyles;
}

interface RecentApplicationsProps {
  applications: ApplicationWithJob[];
}

export function RecentApplications({ applications }: RecentApplicationsProps) {
  const t = useTranslations("dashboard");
  const tApp = useTranslations("applications");

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">
        {t("recentApplications")}
      </h2>
      <div className="rounded-lg border bg-card">
        {/* Header - hidden on small mobile, visible from sm+ */}
        <div className="hidden sm:grid grid-cols-3 gap-4 px-4 py-3 border-b bg-muted/50">
          <span className="text-sm font-medium text-muted-foreground">
            {t("jobTitle")}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {t("company")}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {t("status")}
          </span>
        </div>

        {/* Rows - stack on mobile, grid on sm+ */}
        {applications.map((app) => {
          const status = app.status;
          const isKnown = isApplicationStatus(status);
          const variant = status === "saved" ? "secondary" : "default";
          const customStyle =
            isKnown && status !== "saved" ? statusStyles[status] : undefined;

          return (
            <div
              key={app.id}
              className="flex flex-col gap-1 px-4 py-3 border-b last:border-b-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:items-center"
            >
              <span
                className="text-sm font-medium truncate"
                title={app.job_listings?.title ?? ""}
              >
                {app.job_listings?.title ?? t("unknownJob")}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                {app.job_listings?.company_name ?? t("unknownCompany")}
              </span>
              <div>
                <Badge
                  variant={variant}
                  className={cn(customStyle)}
                >
                  {isKnown ? tApp(status) : status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
