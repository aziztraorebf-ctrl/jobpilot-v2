import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { render } from "@react-email/components";
import {
  getProfilesWithAutoSearch,
  getJobs,
  getScoreMap,
  getStaleApplications,
  getWeeklyStats,
  getTopScoredUnseenJobs,
} from "@/lib/supabase/queries";
import { sendEmail } from "@/lib/services/email-service";
import { WeeklySummary } from "@/emails/weekly-summary";
import { FollowUpReminder } from "@/emails/follow-up-reminder";
import { NewJobsAlert } from "@/emails/new-jobs-alert";
import { insertCronRun } from "@/lib/supabase/queries";

const ROUTE = "/api/cron/notifications";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  const startedAt = Date.now();
  try {
    const profiles = await getProfilesWithAutoSearch();
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const profile of profiles) {
      try {
        const prefs = (profile.search_preferences ?? {}) as Record<
          string,
          unknown
        >;
        const frequency =
          (prefs.notification_frequency as string | undefined) ?? "manual";

        // Weekly summary (only for weekly or daily users)
        if (frequency === "weekly" || frequency === "daily") {
          const stats = await getWeeklyStats(profile.id, 7);
          const recentJobs = await getJobs({ limit: 50 });
          const jobIds = recentJobs.map((j) => j.id);
          const scores = await getScoreMap(profile.id, jobIds);
          const avgScore =
            jobIds.length > 0
              ? Math.round(
                  jobIds.reduce((sum, id) => sum + (scores[id] ?? 0), 0) /
                    jobIds.length
                )
              : 0;

          const topJobs = recentJobs
            .filter((j) => (scores[j.id] ?? 0) >= 60)
            .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
            .slice(0, 5)
            .map((j) => ({
              title: j.title,
              company: j.company_name ?? "Unknown",
              score: scores[j.id] ?? 0,
              description: j.description,
            }));

          const weekOf = new Date().toISOString().split("T")[0];

          const summaryHtml = await render(
            WeeklySummary({
              weekOf,
              newJobsCount: recentJobs.length,
              appliedCount: stats.appliedCount,
              interviewCount: stats.interviewCount,
              avgScore,
              topJobs,
            })
          );

          const summaryResult = await sendEmail({
            subject: `[JobPilot] Resume hebdomadaire - ${weekOf}`,
            html: summaryHtml,
          });
          if (!summaryResult.success) {
            emailsFailed++;
            console.error(
              `[Cron notifications] Weekly summary email failed for profile ${profile.id}:`,
              summaryResult.error
            );
            throw new Error(`Email send failed: ${summaryResult.error}`);
          }
          emailsSent++;
        }

        // Follow-up reminders (for all non-manual users)
        const staleApps = await getStaleApplications(profile.id, 14);
        if (staleApps.length > 0) {
          const now = new Date();
          const apps = staleApps.map((app) => {
            const appliedDate = app.applied_at
              ? new Date(app.applied_at)
              : new Date(app.saved_at);
            const daysAgo = Math.floor(
              (now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            return {
              jobTitle: app.job_listings?.title ?? "Sans titre",
              company: app.job_listings?.company_name ?? "Inconnu",
              appliedDaysAgo: daysAgo,
              status: app.status,
              description: app.job_listings?.description,
            };
          });

          const reminderHtml = await render(
            FollowUpReminder({
              applications: apps,
              date: new Date().toISOString().split("T")[0],
            })
          );

          const reminderResult = await sendEmail({
            subject: `[JobPilot] ${apps.length} candidature(s) a relancer`,
            html: reminderHtml,
          });
          if (!reminderResult.success) {
            emailsFailed++;
            console.error(
              `[Cron notifications] Follow-up reminder email failed for profile ${profile.id}:`,
              reminderResult.error
            );
            throw new Error(`Email send failed: ${reminderResult.error}`);
          }
          emailsSent++;
        }
        // New matches digest — envoyé pour tous les profils
        const threshold = (prefs.alert_threshold as number | undefined) ?? 60;
        const topJobs = await getTopScoredUnseenJobs(profile.id, threshold, 10);
        if (topJobs.length > 0) {
          const matchesHtml = await render(
            NewJobsAlert({
              jobs: topJobs.map((j) => ({
                title: j.title,
                company: j.company_name ?? "Inconnu",
                location: null,
                score: j.overall_score,
                sourceUrl: j.source_url,
              })),
              threshold,
              date: new Date().toISOString().split("T")[0],
              keywords: [],
            })
          );

          const matchesResult = await sendEmail({
            subject: `[JobPilot] ${topJobs.length} nouvelle(s) offre(s) à consulter`,
            html: matchesHtml,
          });
          if (!matchesResult.success) {
            emailsFailed++;
            console.error(
              `[Cron notifications] New matches email failed for profile ${profile.id}:`,
              matchesResult.error
            );
          } else {
            emailsSent++;
          }
        }
      } catch (profileError: unknown) {
        const msg = profileError instanceof Error ? profileError.message : String(profileError);
        console.error(`[Cron notifications] Profile ${profile.id} failed:`, msg);
        Sentry.captureException(profileError, {
          tags: { cron: "notifications", profileId: profile.id },
        });
      }
    }

    await insertCronRun({
      route: ROUTE,
      success: emailsFailed === 0,
      duration_ms: Date.now() - startedAt,
      metadata: { emailsSent, emailsFailed },
    });
    return NextResponse.json(
      { message: "Notifications sent", emailsSent, emailsFailed },
      { status: emailsFailed > 0 ? 500 : 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron notifications]", message);
    Sentry.captureException(error, { tags: { cron: "notifications" } });
    await insertCronRun({
      route: ROUTE,
      success: false,
      duration_ms: Date.now() - startedAt,
      error_message: message,
    });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
