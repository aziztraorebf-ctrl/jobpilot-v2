import { NextResponse } from "next/server";
import { render } from "@react-email/components";
import {
  getProfilesWithAutoSearch,
  getJobs,
  getScoreMap,
  getStaleApplications,
  getWeeklyStats,
} from "@/lib/supabase/queries";
import { sendEmail } from "@/lib/services/email-service";
import { WeeklySummary } from "@/emails/weekly-summary";
import { FollowUpReminder } from "@/emails/follow-up-reminder";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    let emailsSent = 0;

    for (const profile of profiles) {
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

        await sendEmail({
          subject: `[JobPilot] Resume hebdomadaire - ${weekOf}`,
          html: summaryHtml,
        });
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
          };
        });

        const reminderHtml = await render(
          FollowUpReminder({
            applications: apps,
            date: new Date().toISOString().split("T")[0],
          })
        );

        await sendEmail({
          subject: `[JobPilot] ${apps.length} candidature(s) a relancer`,
          html: reminderHtml,
        });
        emailsSent++;
      }
    }

    return NextResponse.json({ message: "Notifications sent", emailsSent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron notifications]", message);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
