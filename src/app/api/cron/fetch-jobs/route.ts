import { NextResponse } from "next/server";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { upsertJobs, getProfilesWithAutoSearch, getScoreMap } from "@/lib/supabase/queries";
import { sendEmail } from "@/lib/services/email-service";
import { render } from "@react-email/components";
import { NewJobsAlert } from "@/emails/new-jobs-alert";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ message: "No profiles with auto-search", fetched: 0 });
    }

    let totalInserted = 0;

    for (const profile of profiles) {
      try {
        const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
        const keywords = (prefs.keywords as string[] | undefined) ?? [];
        const locations = (prefs.locations as string[] | undefined) ?? [];
        const threshold = (prefs.alert_threshold as number | undefined) ?? 60;

        if (keywords.length === 0) continue;

        const query = keywords.join(" ");
        const location = locations[0] ?? "Canada";

        // Fetch new jobs
        const result = await aggregateJobSearch({ keywords: query, location });
        if (result.jobs.length === 0) continue;

        // Upsert into DB
        const inserted = await upsertJobs(result.jobs);
        totalInserted += inserted.length;

        // Check for high-scoring jobs to notify about
        if (inserted.length > 0) {
          const insertedIds = inserted.map((j) => j.id);
          const scores = await getScoreMap(profile.id, insertedIds);
          const highScoreJobs = inserted
            .filter((j) => (scores[j.id] ?? 0) >= threshold)
            .map((j) => ({
              title: j.title,
              company: j.company_name ?? "Unknown",
              location: j.location,
              score: scores[j.id] ?? 0,
              sourceUrl: j.source_url,
              description: j.description,
            }));

          if (highScoreJobs.length > 0) {
            const html = await render(
              NewJobsAlert({
                jobs: highScoreJobs,
                threshold,
                date: new Date().toISOString().split("T")[0],
                keywords,
              })
            );

            await sendEmail({
              subject: `[JobPilot] ${highScoreJobs.length} nouvelle(s) offre(s) correspondante(s)`,
              html,
            });
          }
        }
      } catch (profileError: unknown) {
        const msg = profileError instanceof Error ? profileError.message : String(profileError);
        console.error(`[Cron fetch-jobs] Profile ${profile.id} failed:`, msg);
      }
    }

    return NextResponse.json({ message: "Cron completed", fetched: totalInserted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron fetch-jobs]", message);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
