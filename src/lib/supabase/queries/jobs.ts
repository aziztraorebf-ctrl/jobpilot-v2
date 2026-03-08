import { getSupabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";
import type { UnifiedJob } from "@/lib/schemas/job";

type JobRow = Database["public"]["Tables"]["job_listings"]["Row"];
type JobInsert = Database["public"]["Tables"]["job_listings"]["Insert"];

export type { JobRow };

export interface JobFilters {
  search?: string;
  source?: JobRow["source"];
  remoteType?: JobRow["remote_type"];
  limit?: number;
  offset?: number;
  inbox?: boolean; // If true: fetch unseen/undismissed jobs only, ordered by fetched_at DESC
  userId?: string; // Required when inbox=true to filter out seen/dismissed jobs
}

/**
 * Map a UnifiedJob to the shape expected by the job_listings INSERT type.
 */
function mapUnifiedJobToInsert(job: UnifiedJob): JobInsert {
  return {
    source: job.source,
    source_id: job.source_id,
    source_url: job.source_url,
    dedup_hash: job.dedup_hash,
    title: job.title,
    company_name: job.company_name,
    location: job.location,
    location_lat: job.location_lat,
    location_lng: job.location_lng,
    description: job.description,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    salary_is_predicted: job.salary_is_predicted,
    job_type: job.job_type,
    category: job.category,
    contract_type: job.contract_type,
    remote_type: job.remote_type,
    posted_at: job.posted_at,
    raw_data: job.raw_data as Json,
  };
}

/**
 * Upsert jobs into job_listings using dedup_hash for deduplication.
 *
 * Uses the UNIQUE constraint on dedup_hash with Supabase native .upsert()
 * and ignoreDuplicates to skip existing rows cleanly.
 */
export async function upsertJobs(jobs: UnifiedJob[]): Promise<JobRow[]> {
  if (jobs.length === 0) return [];

  const supabase = getSupabase();
  const rows = jobs.map(mapUnifiedJobToInsert);

  const { data, error } = await supabase
    .from("job_listings")
    .upsert(rows, { onConflict: "dedup_hash", ignoreDuplicates: true })
    .select();

  if (error) {
    throw new Error(`Failed to upsert jobs: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch active job listings with optional filtering.
 * - is_active=true only
 * - inbox=true: excludes already seen/dismissed jobs for userId, fetches up to 50 candidates
 * - search: ilike on title and company_name
 * - source: exact match
 * - remoteType: exact match on remote_type
 * - Ordered by fetched_at DESC
 * - Supports limit (default 50) and offset (default 0)
 */
export async function getJobs(filters?: JobFilters): Promise<JobRow[]> {
  const supabase = getSupabase();
  const inbox = filters?.inbox ?? false;
  // In inbox mode, fetch 50 candidates so the caller can sort by score and take top 15
  const limit = inbox ? 50 : (filters?.limit ?? 50);
  const offset = filters?.offset ?? 0;

  // In inbox mode, exclude jobs already seen or dismissed by this user
  let excludeIds: string[] = [];
  if (inbox && filters?.userId) {
    const { data: seenRows } = await supabase
      .from("seen_jobs")
      .select("job_listing_id")
      .eq("user_id", filters.userId);
    excludeIds = (seenRows ?? []).map((r) => r.job_listing_id);
  }

  let query = supabase
    .from("job_listings")
    .select("*")
    .eq("is_active", true)
    .order("fetched_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }

  if (filters?.remoteType) {
    query = query.eq("remote_type", filters.remoteType);
  }

  if (filters?.search) {
    // Escape LIKE wildcards and PostgREST filter-syntax characters
    // (commas and parentheses are .or() separators/grouping in PostgREST)
    const escaped = filters.search.replace(/[%_\\,()]/g, "\\$&");
    const term = `%${escaped}%`;
    query = query.or(`title.ilike.${term},company_name.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch a single job listing by its UUID.
 * Throws if not found.
 */
export async function getJobById(jobId: string): Promise<JobRow> {
  if (!jobId) {
    throw new Error("jobId is required");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("job_listings")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch job: ${error.message}`);
  }

  return data;
}

/**
 * Dismiss a job for the current user by upserting into seen_jobs
 * with dismissed=true.
 *
 * Uses a single .upsert() call with the UNIQUE constraint on
 * (user_id, job_listing_id) to insert or update in one round-trip.
 */
export async function dismissJob(userId: string, jobListingId: string): Promise<void> {
  if (!jobListingId) {
    throw new Error("jobListingId is required");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("seen_jobs")
    .upsert(
      { user_id: userId, job_listing_id: jobListingId, dismissed: true },
      { onConflict: "user_id,job_listing_id" }
    );

  if (error) {
    throw new Error(`Failed to dismiss job: ${error.message}`);
  }
}

/**
 * Mark a job as seen for the current user by upserting into seen_jobs
 * with dismissed=false.
 *
 * Uses a single .upsert() call with the UNIQUE constraint on
 * (user_id, job_listing_id) to insert or update in one round-trip.
 */
export async function markJobSeen(userId: string, jobListingId: string): Promise<void> {
  if (!jobListingId) {
    throw new Error("jobListingId is required");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("seen_jobs")
    .upsert(
      { user_id: userId, job_listing_id: jobListingId, dismissed: false },
      { onConflict: "user_id,job_listing_id" }
    );

  if (error) {
    throw new Error(`Failed to mark job as seen: ${error.message}`);
  }
}

/**
 * Get all dismissed job listing IDs for the current user.
 * Returns an array of job_listing_id strings.
 */
export async function getDismissedJobIds(userId: string): Promise<string[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("seen_jobs")
    .select("job_listing_id")
    .eq("user_id", userId)
    .eq("dismissed", true);

  if (error) {
    throw new Error(`Failed to fetch dismissed jobs: ${error.message}`);
  }

  return (data ?? []).map((row) => row.job_listing_id);
}

/**
 * Fetch full job data for all dismissed jobs for a given user.
 * Joins seen_jobs -> job_listings to return complete job rows.
 */
export async function getDismissedJobs(userId: string): Promise<JobRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("seen_jobs")
    .select("job_listing_id, job_listings(*)")
    .eq("user_id", userId)
    .eq("dismissed", true)
    .order("seen_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch dismissed jobs: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (row as Record<string, unknown>).job_listings)
    .filter(Boolean) as JobRow[];
}

/**
 * Restore a previously dismissed job by setting dismissed=false.
 */
export async function restoreJob(userId: string, jobListingId: string): Promise<void> {
  if (!jobListingId) {
    throw new Error("jobListingId is required");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("seen_jobs")
    .update({ dismissed: false })
    .eq("user_id", userId)
    .eq("job_listing_id", jobListingId);

  if (error) {
    throw new Error(`Failed to restore job: ${error.message}`);
  }
}

/**
 * Get seen job data (id + seen_at) for the current user (not dismissed).
 */
export async function getSeenJobIds(userId: string): Promise<{ id: string; seen_at: string }[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("seen_jobs")
    .select("job_listing_id, seen_at")
    .eq("user_id", userId)
    .eq("dismissed", false);

  if (error) {
    throw new Error(`Failed to fetch seen jobs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({ id: row.job_listing_id, seen_at: row.seen_at ?? new Date().toISOString() }));
}

const UNSEEN_EXPIRY_DAYS = 7;
const ABSOLUTE_EXPIRY_DAYS = 30;

/**
 * Expire job listings that are too old:
 * - Unseen (no seen_jobs entry) + older than UNSEEN_EXPIRY_DAYS
 * - All jobs older than ABSOLUTE_EXPIRY_DAYS
 * Returns count of expired jobs.
 */
export async function expireOldJobs(): Promise<{ expired: number }> {
  const supabase = getSupabase();
  const now = new Date();

  const unseenCutoff = new Date(now.getTime() - UNSEEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const absoluteCutoff = new Date(now.getTime() - ABSOLUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1. Expire jobs older than 30 days (absolute)
  const { error: absoluteError, count: absoluteCount } = await supabase
    .from("job_listings")
    .update({ is_active: false }, { count: "exact" })
    .eq("is_active", true)
    .lt("fetched_at", absoluteCutoff);

  if (absoluteError) {
    throw new Error(`Failed to expire old jobs (absolute): ${absoluteError.message}`);
  }

  // 2. Get IDs of jobs that have been seen (have an entry in seen_jobs)
  const { data: seenJobIds, error: seenError } = await supabase
    .from("seen_jobs")
    .select("job_listing_id");

  if (seenError) {
    throw new Error(`Failed to fetch seen job IDs: ${seenError.message}`);
  }

  const seenIds = (seenJobIds ?? []).map((r) => r.job_listing_id);

  let unseenExpiredCount = 0;
  if (seenIds.length > 0) {
    // Expire active jobs not in seen list, older than 7 days
    const { error: unseenError, count } = await supabase
      .from("job_listings")
      .update({ is_active: false }, { count: "exact" })
      .eq("is_active", true)
      .lt("fetched_at", unseenCutoff)
      .not("id", "in", `(${seenIds.join(",")})`);

    if (unseenError) {
      throw new Error(`Failed to expire unseen jobs: ${unseenError.message}`);
    }
    unseenExpiredCount = count ?? 0;
  } else {
    // No seen jobs at all — expire all unseen older than 7 days
    const { error: unseenError, count } = await supabase
      .from("job_listings")
      .update({ is_active: false }, { count: "exact" })
      .eq("is_active", true)
      .lt("fetched_at", unseenCutoff);

    if (unseenError) {
      throw new Error(`Failed to expire unseen jobs: ${unseenError.message}`);
    }
    unseenExpiredCount = count ?? 0;
  }

  return { expired: (absoluteCount ?? 0) + unseenExpiredCount };
}

/**
 * One-shot cleanup: deactivate all jobs with no score entry (never scored).
 * Used to clean up the initial backlog of unscored jobs.
 * Returns count of deactivated jobs.
 */
export async function cleanupUnscoredJobs(): Promise<{ deactivated: number }> {
  const supabase = getSupabase();

  // Get IDs of jobs that have at least one score
  const { data: scoredJobIds, error: scoredError } = await supabase
    .from("match_scores")
    .select("job_listing_id");

  if (scoredError) {
    throw new Error(`Failed to fetch scored job IDs: ${scoredError.message}`);
  }

  const scoredIds = (scoredJobIds ?? []).map((r) => r.job_listing_id);

  if (scoredIds.length === 0) {
    // No scores at all — deactivate everything
    const { error, count } = await supabase
      .from("job_listings")
      .update({ is_active: false }, { count: "exact" })
      .eq("is_active", true);

    if (error) throw new Error(`Failed to cleanup unscored jobs: ${error.message}`);
    return { deactivated: count ?? 0 };
  }

  // Deactivate active jobs NOT in scoredIds
  const { error, count } = await supabase
    .from("job_listings")
    .update({ is_active: false }, { count: "exact" })
    .eq("is_active", true)
    .not("id", "in", `(${scoredIds.join(",")})`);

  if (error) throw new Error(`Failed to cleanup unscored jobs: ${error.message}`);
  return { deactivated: count ?? 0 };
}
