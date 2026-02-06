import { getTranslations } from "next-intl/server";
import {
  getApplications,
  getScoreMap,
} from "@/lib/supabase/queries";
import type { ApplicationWithJob } from "@/lib/supabase/queries";
import { ApplicationsPageClient } from "@/components/applications/applications-page-client";
import { requireUser } from "@/lib/supabase/get-user";

export default async function ApplicationsPage() {
  const t = await getTranslations("applications");
  const user = await requireUser();

  let applications: ApplicationWithJob[];
  try {
    applications = await getApplications(user.id);
  } catch (error) {
    console.error("[ApplicationsPage] Failed to fetch applications:", error);
    applications = [];
  }

  const jobIds = applications
    .map((a) => a.job_listing_id)
    .filter(Boolean);

  let scoreMap: Record<string, number> = {};
  try {
    scoreMap = jobIds.length > 0 ? await getScoreMap(user.id, jobIds) : {};
  } catch (error) {
    console.error("[ApplicationsPage] Failed to fetch scores:", error);
  }

  return (
    <div className="p-6 space-y-6">
      <ApplicationsPageClient
        applications={applications}
        scoreMap={scoreMap}
        title={t("title")}
      />
    </div>
  );
}
