import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ScoreRow = Database["public"]["Tables"]["match_scores"]["Row"];
type ScoreInsert = Database["public"]["Tables"]["match_scores"]["Insert"];

export type { ScoreRow, ScoreInsert };

/**
 * Fetch match scores for given job IDs and return a map of job_listing_id -> overall_score.
 * Returns an empty object if jobIds is empty (avoids unnecessary query).
 */
export async function getScoreMap(
  userId: string,
  jobIds: string[]
): Promise<Record<string, number>> {
  if (jobIds.length === 0) {
    return {};
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .select("job_listing_id, overall_score")
    .eq("user_id", userId)
    .in("job_listing_id", jobIds);

  if (error) {
    throw new Error(`Failed to fetch score map: ${error.message}`);
  }

  const map: Record<string, number> = {};
  for (const row of data) {
    map[row.job_listing_id] = row.overall_score;
  }
  return map;
}

/**
 * Fetch full score rows for given job IDs.
 * Returns an empty array if jobIds is empty (avoids unnecessary query).
 */
export async function getScoresForJobs(
  userId: string,
  jobIds: string[]
): Promise<ScoreRow[]> {
  if (jobIds.length === 0) {
    return [];
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .select("*")
    .eq("user_id", userId)
    .in("job_listing_id", jobIds);

  if (error) {
    throw new Error(`Failed to fetch scores for jobs: ${error.message}`);
  }

  return data;
}

/**
 * Insert or update a match score.
 * Uses upsert with onConflict on (user_id, job_listing_id, resume_id)
 * to handle duplicate entries gracefully.
 * Returns the upserted row.
 */
export async function upsertScore(score: ScoreInsert): Promise<ScoreRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .upsert(score, { onConflict: "user_id,job_listing_id,resume_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert score: ${error.message}`);
  }

  return data;
}

/**
 * Check if a score already exists for a specific job + resume combination.
 * Returns the score row if found, or null if not (used for cache checking).
 */
export async function getScoreForJob(
  userId: string,
  jobId: string,
  resumeId: string
): Promise<ScoreRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("job_listing_id", jobId)
    .eq("resume_id", resumeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch score for job: ${error.message}`);
  }

  return data;
}

/**
 * Fetch the most recent score for a specific job, regardless of resume.
 * Returns the latest match_scores row or null if none exists.
 */
export async function getLatestScoreForJob(
  userId: string,
  jobId: string
): Promise<ScoreRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("job_listing_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest score for job: ${error.message}`);
  }

  return data;
}

/**
 * Returns job IDs that were scored using a specific resume, for the current user.
 */
export async function getJobIdsByResumeId(
  userId: string,
  resumeId: string
): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .select("job_listing_id")
    .eq("user_id", userId)
    .eq("resume_id", resumeId);

  if (error) throw new Error(`Failed to fetch jobs by resume: ${error.message}`);
  return (data ?? []).map((row) => row.job_listing_id);
}