import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getStaleApplications, getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import {
  getDashboardCounts,
  getRecentJobCount,
  getUnseenJobCount,
  getTopScoredUnseenJobs,
} from "@/lib/supabase/queries/cowork";

interface Action {
  type: string;
  priority: "high" | "medium" | "low";
  reason: string;
  endpoint?: string;
  method?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const HIGH_SCORE_THRESHOLD = 75;
const LOW_UNSEEN_THRESHOLD = 10;
const STALE_DAYS = 7;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ error: "No profiles found" }, { status: 404 });
    }
    const userId = profiles[0].id;

    // Fetch all data in parallel
    const [counts, recentJobs, unseenJobs, stale, topScored] = await Promise.all([
      getDashboardCounts(userId),
      getRecentJobCount(24),
      getUnseenJobCount(userId),
      getStaleApplications(userId, STALE_DAYS),
      getTopScoredUnseenJobs(userId, HIGH_SCORE_THRESHOLD, 5),
    ]);

    const actions: Action[] = [];

    // Rule 1: Need more jobs?
    if (unseenJobs < LOW_UNSEEN_THRESHOLD || recentJobs === 0) {
      actions.push({
        type: "fetch_jobs",
        priority: "high",
        reason:
          recentJobs === 0
            ? "No jobs fetched in the last 24h. Pipeline needs fresh data."
            : `Only ${unseenJobs} unseen jobs remain. Fetch more to keep the pipeline flowing.`,
        endpoint: "/api/cowork/fetch-and-score",
        method: "POST",
      });
    }

    // Rule 2: High-score unseen jobs to apply to
    for (const job of topScored) {
      actions.push({
        type: "apply_high_match",
        priority: "high",
        reason: `Score ${job.overall_score}% — strong match. Save and apply.`,
        endpoint: "/api/cowork/browser-apply",
        method: "POST",
        payload: {
          job_listing_id: job.job_listing_id,
          application_url: job.source_url,
        },
        data: {
          title: job.title,
          company: job.company_name,
          score: job.overall_score,
        },
      });
    }

    // Rule 3: Stale applications needing follow-up
    if (stale.length > 0) {
      actions.push({
        type: "review_stale",
        priority: "medium",
        reason: `${stale.length} application(s) not updated in ${STALE_DAYS}+ days. Review or escalate.`,
        data: {
          count: stale.length,
          applications: stale.map((app) => ({
            id: app.id,
            status: app.status,
            updated_at: app.updated_at,
            title: app.job_listings?.title ?? "Unknown",
            company: app.job_listings?.company_name ?? null,
          })),
        },
      });
    }

    // Rule 4: Send notification if top matches exist and recent fetch happened
    if (recentJobs > 0 && topScored.length > 0) {
      actions.push({
        type: "notify_matches",
        priority: "low",
        reason: `${topScored.length} high-scoring job(s) found. Send email digest.`,
        endpoint: "/api/cowork/notify",
        method: "POST",
        payload: {
          type: "new_matches",
          data: {
            jobs: topScored.map((j) => ({
              title: j.title,
              company: j.company_name,
              location: null,
              sourceUrl: j.source_url,
              overallScore: j.overall_score,
              matchingSkills: [],
            })),
            totalFetched: recentJobs,
            totalScored: topScored.length,
          },
        },
      });
    }

    // Rule 5: Nothing to do
    if (actions.length === 0) {
      actions.push({
        type: "idle",
        priority: "low",
        reason: "Pipeline is healthy. No urgent actions needed.",
      });
    }

    // Sort by priority: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      actions,
      context: {
        unseenJobCount: unseenJobs,
        activeJobs: counts.activeJobs,
        staleApplicationCount: stale.length,
        recentJobsFetched24h: recentJobs,
        totalApplications: counts.totalApplications,
        statusCounts: counts.statusCounts,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error, "cowork/next-actions");
  }
}
