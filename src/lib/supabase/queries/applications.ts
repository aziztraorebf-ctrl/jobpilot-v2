import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

// -- Types -------------------------------------------------------------------

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];
type ApplicationUpdate = Database["public"]["Tables"]["applications"]["Update"];

export type { ApplicationRow, ApplicationInsert, ApplicationUpdate };

/** Application row joined with essential job listing fields. */
export interface ApplicationWithJob {
  id: string;
  user_id: string;
  job_listing_id: string;
  status: string;
  saved_at: string;
  applied_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
  closed_at: string | null;
  notes: string | null;
  priority: number;
  salary_offered: number | null;
  created_at: string;
  updated_at: string;
  job_listings: {
    id: string;
    title: string;
    company_name: string | null;
    location: string | null;
    source_url: string;
    remote_type: string;
  } | null;
}

/** Aggregate stats surfaced on the dashboard. */
export interface DashboardStats {
  newJobs: number;
  avgScore: number;
  activeApplications: number;
  upcomingInterviews: number;
}

// Canonical list of application statuses -- single source of truth
export const APPLICATION_STATUSES = [
  "saved",
  "applying",
  "applied",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

/** Union type derived from APPLICATION_STATUSES. */
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Select string reused across queries that join job_listings
const APPLICATION_WITH_JOB_SELECT = `
  id,
  user_id,
  job_listing_id,
  status,
  saved_at,
  applied_at,
  interview_at,
  offer_at,
  closed_at,
  notes,
  priority,
  salary_offered,
  created_at,
  updated_at,
  job_listings (
    id,
    title,
    company_name,
    location,
    source_url,
    remote_type
  )
` as const;

// Statuses that mark an application as "closed"
const CLOSED_STATUSES = ["rejected", "accepted", "withdrawn"] as const;

// -- Query functions ---------------------------------------------------------

/**
 * Fetch all applications for the current user, joined with job listing data.
 * Results are ordered by updated_at descending (most recent first).
 */
export async function getApplications(userId: string): Promise<ApplicationWithJob[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_WITH_JOB_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<ApplicationWithJob[]>();

  if (error) {
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }

  return data;
}

/**
 * Fetch a single application by ID, joined with job listing data.
 * Throws if the application is not found or the query fails.
 */
export async function getApplicationById(
  userId: string,
  id: string
): Promise<ApplicationWithJob> {
  if (!id) {
    throw new Error("Application ID is required");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_WITH_JOB_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .returns<ApplicationWithJob>()
    .single();

  if (error) {
    throw new Error(`Failed to fetch application: ${error.message}`);
  }

  return data;
}

/**
 * Create a new application with status "saved".
 * Returns the created application row.
 */
export async function createApplication(
  userId: string,
  jobListingId: string
): Promise<ApplicationRow> {
  if (!jobListingId) {
    throw new Error("Job listing ID is required");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      job_listing_id: jobListingId,
      status: "saved",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create application: ${error.message}`);
  }

  return data;
}

/**
 * Update an application's status and set the corresponding timestamp.
 *
 * Timestamp logic:
 * - "applied"    -> applied_at = now
 * - "interview"  -> interview_at = extra.interview_at or now
 * - "offer"      -> offer_at = now
 * - "rejected" | "accepted" | "withdrawn" -> closed_at = now
 *
 * Optional extra fields: interview_at, notes, salary_offered.
 */
export async function updateApplicationStatus(
  userId: string,
  id: string,
  status: ApplicationRow["status"],
  extra?: {
    interview_at?: string;
    notes?: string;
    salary_offered?: number;
  }
): Promise<ApplicationRow> {
  if (!id) {
    throw new Error("Application ID is required");
  }
  if (!status) {
    throw new Error("Status is required");
  }

  const now = new Date().toISOString();

  const updates: ApplicationUpdate = {
    status,
    ...(extra?.notes !== undefined && { notes: extra.notes }),
    ...(extra?.salary_offered !== undefined && {
      salary_offered: extra.salary_offered,
    }),
  };

  // Set the appropriate timestamp based on the new status
  if (status === "applied") {
    updates.applied_at = now;
  } else if (status === "interview") {
    updates.interview_at = extra?.interview_at ?? now;
  } else if (status === "offer") {
    updates.offer_at = now;
  } else if (
    (CLOSED_STATUSES as readonly string[]).includes(status)
  ) {
    updates.closed_at = now;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update application status: ${error.message}`);
  }

  return data;
}

/**
 * Delete an application by ID.
 */
export async function deleteApplication(userId: string, id: string): Promise<void> {
  if (!id) {
    throw new Error("Application ID is required");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete application: ${error.message}`);
  }
}

/**
 * Compute dashboard statistics for the current user.
 *
 * - activeApplications: count of applications NOT in a closed status
 * - upcomingInterviews: count where status = "interview" AND interview_at > now
 * - newJobs:            count of job_listings fetched in the last 7 days
 * - avgScore:           average overall_score from match_scores (0 if none)
 */
export async function getApplicationStats(userId: string): Promise<DashboardStats> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Run all four queries in parallel for performance
  const [activeResult, interviewResult, newJobsResult, avgScoreResult] =
    await Promise.all([
      // 1. Active applications (not closed)
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("status", "in", `(${CLOSED_STATUSES.join(",")})`),

      // 2. Upcoming interviews
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "interview")
        .gt("interview_at", now),

      // 3. New job listings in last 7 days
      supabase
        .from("job_listings")
        .select("id", { count: "exact", head: true })
        .gte("fetched_at", sevenDaysAgo),

      // 4. Average match score for the user
      supabase
        .from("match_scores")
        .select("overall_score")
        .eq("user_id", userId)
        .limit(1000),
    ]);

  // Check for errors on each query
  if (activeResult.error) {
    throw new Error(
      `Failed to count active applications: ${activeResult.error.message}`
    );
  }
  if (interviewResult.error) {
    throw new Error(
      `Failed to count upcoming interviews: ${interviewResult.error.message}`
    );
  }
  if (newJobsResult.error) {
    throw new Error(
      `Failed to count new jobs: ${newJobsResult.error.message}`
    );
  }
  if (avgScoreResult.error) {
    throw new Error(
      `Failed to fetch match scores: ${avgScoreResult.error.message}`
    );
  }

  // Compute average score (0 if no scores exist)
  const scores = avgScoreResult.data ?? [];
  const avgScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce(
            (sum: number, row: { overall_score: number }) =>
              sum + row.overall_score,
            0
          ) /
            scores.length) *
            10
        ) / 10
      : 0;

  return {
    activeApplications: activeResult.count ?? 0,
    upcomingInterviews: interviewResult.count ?? 0,
    newJobs: newJobsResult.count ?? 0,
    avgScore,
  };
}
