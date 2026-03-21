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
  agent_status: AgentStatus | null;
  ats_type: AtsType | null;
  agent_notes: string | null;
  job_listings: {
    id: string;
    title: string;
    company_name: string | null;
    location: string | null;
    source_url: string;
    remote_type: string;
    description: string | null;
  } | null;
}

/** Aggregate stats surfaced on the dashboard. */
export interface DashboardStats {
  activeJobs: number;
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

export const AGENT_STATUSES = [
  "pending",
  "ready",
  "submitted",
  "failed",
  "needs_review",
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const ATS_TYPES = [
  "linkedin",
  "indeed",
  "workday",
  "greenhouse",
  "lever",
  "other",
] as const;
export type AtsType = (typeof ATS_TYPES)[number];

export interface ApplicationForAgent {
  id: string;
  job_title: string;
  company: string | null;
  apply_url: string;
  ats_type: AtsType | null;
  cover_letter: string | null;
  resume_file_path: string | null;
  resume_signed_url: string | null;
  status: AgentStatus;
  notes: string | null;
}

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
  agent_status,
  ats_type,
  agent_notes,
  job_listings (
    id,
    title,
    company_name,
    location,
    source_url,
    remote_type,
    description
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

  return data ?? [];
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

  // Run queries in parallel for performance
  const [activeResult, interviewResult, seenResult, avgScoreResult] =
    await Promise.all([
      // 1. Active applications (not closed)
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("status", "in", `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(",")})`),

      // 2. Upcoming interviews
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "interview")
        .gt("interview_at", now),

      // 3. Seen job IDs for this user (to exclude from unseen count)
      supabase
        .from("seen_jobs")
        .select("job_listing_id")
        .eq("user_id", userId),

      // 4. Average match score for the user
      supabase
        .from("match_scores")
        .select("overall_score")
        .eq("user_id", userId)
        .limit(1000),
    ]);

  // Check for errors
  if (activeResult.error) {
    throw new Error(`Failed to count active applications: ${activeResult.error.message}`);
  }
  if (interviewResult.error) {
    throw new Error(`Failed to count upcoming interviews: ${interviewResult.error.message}`);
  }
  if (seenResult.error) {
    throw new Error(`Failed to fetch seen jobs: ${seenResult.error.message}`);
  }
  if (avgScoreResult.error) {
    throw new Error(`Failed to fetch match scores: ${avgScoreResult.error.message}`);
  }

  // Count unseen active jobs: fetch all active IDs, exclude seen ones
  const seenIds = new Set((seenResult.data ?? []).map((r) => r.job_listing_id));
  const { data: activeJobIds, error: activeJobsError } = await supabase
    .from("job_listings")
    .select("id")
    .eq("is_active", true);
  if (activeJobsError) {
    throw new Error(`Failed to count active jobs: ${activeJobsError.message}`);
  }
  const unseenCount = (activeJobIds ?? []).filter((j) => !seenIds.has(j.id)).length;

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
    activeJobs: unseenCount,
    avgScore,
  };
}

/**
 * Fetch applications that haven't been updated in the given number of days.
 * Returns applications in "applied" or "interview" status only.
 */
export async function getStaleApplications(
  userId: string,
  staleDays: number = 14
): Promise<ApplicationWithJob[]> {
  const supabase = getSupabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_WITH_JOB_SELECT)
    .eq("user_id", userId)
    .in("status", ["applied", "interview"])
    .lt("updated_at", cutoff.toISOString())
    .order("updated_at", { ascending: true })
    .returns<ApplicationWithJob[]>();

  if (error) {
    throw new Error(`Failed to fetch stale applications: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get application stats for the past N days.
 */
export async function getWeeklyStats(
  userId: string,
  days: number = 7
): Promise<{ appliedCount: number; interviewCount: number }> {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("applications")
    .select("status")
    .eq("user_id", userId)
    .gte("updated_at", since.toISOString());

  if (error) {
    throw new Error(`Failed to fetch weekly stats: ${error.message}`);
  }

  const rows = data ?? [];
  return {
    appliedCount: rows.filter((r) => r.status === "applied").length,
    interviewCount: rows.filter((r) => r.status === "interview").length,
  };
}

/**
 * Fetch all applications with agent_status = 'ready', joined with
 * job listing data, cover letter content, and resume signed URL.
 * Called exclusively by the agent endpoint (Bearer auth).
 */
export async function getReadyApplicationsForAgent(): Promise<ApplicationForAgent[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("applications")
    .select(`
      id,
      agent_status,
      agent_notes,
      ats_type,
      resume_id,
      job_listings (
        title,
        company_name,
        source_url
      ),
      cover_letters (
        content
      ),
      resumes (
        file_path
      )
    `)
    .eq("agent_status", "ready")
    .returns<Array<{
      id: string;
      agent_status: string;
      agent_notes: string | null;
      ats_type: string | null;
      resume_id: string | null;
      job_listings: { title: string; company_name: string | null; source_url: string } | null;
      cover_letters: { content: string } | null;
      resumes: { file_path: string } | null;
    }>>();

  if (error) {
    throw new Error(`Failed to fetch ready applications: ${error.message}`);
  }

  const rows = data ?? [];

  // Générer les URLs signées pour les CVs en parallèle
  const results = await Promise.all(
    rows.map(async (row) => {
      let resumeSignedUrl: string | null = null;

      if (row.resumes?.file_path) {
        const { data: signedData } = await supabase.storage
          .from("resumes")
          .createSignedUrl(row.resumes.file_path, 10800); // 3h
        resumeSignedUrl = signedData?.signedUrl ?? null;
      }

      return {
        id: row.id,
        job_title: row.job_listings?.title ?? "Titre inconnu",
        company: row.job_listings?.company_name ?? null,
        apply_url: row.job_listings?.source_url ?? "",
        ats_type: (row.ats_type as AtsType) ?? null,
        cover_letter: row.cover_letters?.content ?? null,
        resume_file_path: row.resumes?.file_path ?? null,
        resume_signed_url: resumeSignedUrl,
        status: (row.agent_status as AgentStatus) ?? "ready",
        notes: row.agent_notes,
      } satisfies ApplicationForAgent;
    })
  );

  return results;
}

/**
 * Update agent_status (and optionally agent_notes) on an application.
 * Called by the agent after each submission attempt.
 * No user_id scoping — authenticated by Bearer token at route level.
 * Sets applied_at = now when agent_status = 'submitted'.
 */
export async function updateAgentStatus(
  id: string,
  agentStatus: AgentStatus,
  agentNotes?: string
): Promise<void> {
  if (!id) throw new Error("Application ID is required");

  const supabase = getSupabase();
  const updates: {
    agent_status: AgentStatus;
    agent_notes?: string;
    applied_at?: string;
  } = {
    agent_status: agentStatus,
  };

  if (agentNotes !== undefined) updates.agent_notes = agentNotes;
  if (agentStatus === "submitted") updates.applied_at = new Date().toISOString();

  const { error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update agent status: ${error.message}`);
  }
}
