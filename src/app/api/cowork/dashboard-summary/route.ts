import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getProfile, getStaleApplications, getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import { getDashboardCounts, getRecentJobCount, getUnseenJobCount } from "@/lib/supabase/queries/cowork";
import { parseSearchPreferences } from "@/types/search-preferences";

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

    const [profile, counts, recentJobs, stale, unseenJobs] = await Promise.all([
      getProfile(userId),
      getDashboardCounts(userId),
      getRecentJobCount(24),
      getStaleApplications(userId, 7),
      getUnseenJobCount(userId),
    ]);

    const prefs = parseSearchPreferences(profile.search_preferences);

    return NextResponse.json({
      preferences: prefs,
      dashboard: {
        ...counts,
        recentJobsFetched24h: recentJobs,
        staleApplicationCount: stale.length,
        unseenJobCount: unseenJobs,
      },
    });
  } catch (error) {
    return apiError(error, "cowork/dashboard-summary");
  }
}
