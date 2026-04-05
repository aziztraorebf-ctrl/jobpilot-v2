import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getStaleApplications, getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import { updateAgentStatus } from "@/lib/supabase/queries/applications";
import { checkJobStillActive } from "@/lib/services/stale-checker";

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

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "7", 10);
    const checkUrls = url.searchParams.get("check_urls") === "true";

    const stale = await getStaleApplications(userId, days);

    // Optionally verify if job postings are still active via Firecrawl
    let closedCount = 0;
    if (checkUrls && stale.length > 0) {
      // Check max 5 URLs per call to limit Firecrawl credit usage
      const toCheck = stale.slice(0, 5).filter((a) => a.job_listings?.source_url);

      const results = await Promise.allSettled(
        toCheck.map(async (app) => {
          const sourceUrl = app.job_listings!.source_url;
          const result = await checkJobStillActive(sourceUrl);

          if (!result.active) {
            await updateAgentStatus(
              app.id,
              "needs_review",
              `Job posting appears closed: ${result.reason}`
            );
            closedCount++;
          }

          return { applicationId: app.id, ...result };
        })
      );

      const checkResults = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ applicationId: string; active: boolean; reason: string }>).value);

      return NextResponse.json({
        count: stale.length,
        applications: stale,
        urlChecks: {
          checked: toCheck.length,
          closed: closedCount,
          results: checkResults,
        },
      });
    }

    return NextResponse.json({ count: stale.length, applications: stale });
  } catch (error) {
    return apiError(error, "cowork/stale-applications");
  }
}
