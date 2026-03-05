import { getTranslations } from "next-intl/server";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopJobs } from "@/components/dashboard/top-jobs";
import { RecentApplications } from "@/components/dashboard/recent-applications";
import { ActiveProfileBanner } from "@/components/dashboard/active-profile-banner";
import {
  getApplicationStats,
  getJobs,
  getApplications,
  getScoreMap,
} from "@/lib/supabase/queries";
import type { ApplicationWithJob } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { getProfile } from "@/lib/supabase/queries/profiles";

/**
 * Pick up to `limit` recent applications with varied statuses.
 * Deduplicates by status so the dashboard overview is more informative.
 */
function pickRecentVaried(
  apps: ApplicationWithJob[],
  limit: number
): ApplicationWithJob[] {
  const seenStatuses = new Set<string>();
  const result: ApplicationWithJob[] = [];

  // apps are already sorted by updated_at DESC from getApplications()
  for (const app of apps) {
    if (result.length >= limit) break;
    if (seenStatuses.has(app.status)) continue;
    seenStatuses.add(app.status);
    result.push(app);
  }

  return result;
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const user = await requireUser();

  let stats: Awaited<ReturnType<typeof getApplicationStats>>;
  let jobs: Awaited<ReturnType<typeof getJobs>>;
  let applications: ApplicationWithJob[];

  try {
    [stats, jobs, applications] = await Promise.all([
      getApplicationStats(user.id),
      getJobs({ limit: 50 }),
      getApplications(user.id),
    ]);
  } catch (error) {
    console.error("[DashboardPage] Failed to fetch data:", error);
    stats = { activeJobs: 0, avgScore: 0, activeApplications: 0, upcomingInterviews: 0 };
    jobs = [];
    applications = [];
  }

  let scoreMap: Record<string, number> = {};
  try {
    const jobIds = jobs.map((j) => j.id);
    scoreMap = jobIds.length > 0 ? await getScoreMap(user.id, jobIds) : {};
  } catch (error) {
    console.error("[DashboardPage] Failed to fetch scores:", error);
  }

  let searchPreferences: Record<string, unknown> | null = null;
  try {
    const profile = await getProfile(user.id);
    searchPreferences = (profile.search_preferences ?? null) as Record<string, unknown> | null;
  } catch (error) {
    console.error("[DashboardPage] Failed to fetch profile:", error);
  }

  // Top 5 jobs by score
  const topJobs = [...jobs]
    .sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
    .slice(0, 5);

  // 3 most recent applications with varied statuses
  const recentApps = pickRecentVaried(applications, 3);

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <ActiveProfileBanner searchPreferences={searchPreferences} />
      <StatsCards stats={stats} />
      <TopJobs jobs={topJobs} scoreMap={scoreMap} />
      <RecentApplications applications={recentApps} />
    </div>
  );
}
