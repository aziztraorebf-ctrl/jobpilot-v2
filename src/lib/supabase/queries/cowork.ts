import { getSupabase } from "@/lib/supabase/client";

/**
 * Get the count of jobs fetched in the last N hours.
 */
export async function getRecentJobCount(hours = 24): Promise<number> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("job_listings")
    .select("id", { count: "exact", head: true })
    .gte("fetched_at", since);

  if (error) {
    throw new Error(`Failed to count recent jobs: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Get summary counts for the cowork dashboard:
 *  - total active jobs
 *  - total applications
 *  - applications by status
 */
export async function getDashboardCounts(userId: string) {
  const supabase = getSupabase();

  const [jobsResult, appsResult] = await Promise.all([
    supabase
      .from("job_listings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("applications")
      .select("id, status")
      .eq("user_id", userId),
  ]);

  if (jobsResult.error) {
    throw new Error(`Failed to count jobs: ${jobsResult.error.message}`);
  }
  if (appsResult.error) {
    throw new Error(`Failed to count applications: ${appsResult.error.message}`);
  }

  const statusCounts: Record<string, number> = {};
  for (const app of appsResult.data ?? []) {
    statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
  }

  return {
    activeJobs: jobsResult.count ?? 0,
    totalApplications: (appsResult.data ?? []).length,
    statusCounts,
  };
}
