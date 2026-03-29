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

/**
 * Count active jobs NOT yet seen/dismissed by the user.
 * Uses server-side RPC to avoid PostgREST payload limits.
 */
export async function getUnseenJobCount(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("count_unseen_jobs", { p_user_id: userId });
  if (error) throw new Error(`Failed to count unseen jobs: ${error.message}`);
  return data ?? 0;
}

/**
 * Get unseen active jobs with high scores (>= threshold), not yet applied to.
 * Returns top N jobs sorted by score descending.
 */
export async function getTopScoredUnseenJobs(
  userId: string,
  minScore: number = 70,
  limit: number = 10
): Promise<
  Array<{
    job_listing_id: string;
    title: string;
    company_name: string | null;
    source_url: string;
    overall_score: number;
  }>
> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("match_scores")
    .select(
      `
      job_listing_id,
      overall_score,
      job_listings!inner (
        id,
        title,
        company_name,
        source_url,
        is_active
      )
    `
    )
    .eq("user_id", userId)
    .gte("overall_score", minScore)
    .eq("job_listings.is_active", true)
    .order("overall_score", { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Failed to fetch top scored unseen jobs: ${error.message}`);

  // Fetch exclusion sets in parallel
  const [appsResult, seenResult] = await Promise.all([
    supabase.from("applications").select("job_listing_id").eq("user_id", userId),
    supabase.from("seen_jobs").select("job_listing_id").eq("user_id", userId),
  ]);

  if (appsResult.error)
    throw new Error(`Failed to fetch application job IDs: ${appsResult.error.message}`);
  if (seenResult.error)
    throw new Error(`Failed to fetch seen jobs: ${seenResult.error.message}`);

  const appliedSet = new Set(
    (appsResult.data ?? []).map((a) => a.job_listing_id)
  );
  const seenSet = new Set(
    (seenResult.data ?? []).map((s) => s.job_listing_id)
  );

  return (data ?? [])
    .filter(
      (row) =>
        !appliedSet.has(row.job_listing_id) &&
        !seenSet.has(row.job_listing_id)
    )
    .map((row) => {
      const job = row.job_listings as unknown as {
        id: string;
        title: string;
        company_name: string | null;
        source_url: string;
      };
      return {
        job_listing_id: row.job_listing_id,
        title: job.title,
        company_name: job.company_name,
        source_url: job.source_url,
        overall_score: row.overall_score,
      };
    });
}
