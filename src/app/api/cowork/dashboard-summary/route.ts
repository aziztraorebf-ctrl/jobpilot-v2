import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getProfile, getStaleApplications } from "@/lib/supabase/queries";
import { getDashboardCounts, getRecentJobCount } from "@/lib/supabase/queries/cowork";
import { parseSearchPreferences } from "@/types/search-preferences";
import { USER_ID } from "@/lib/supabase/constants";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const [profile, counts, recentJobs, stale] = await Promise.all([
      getProfile(USER_ID),
      getDashboardCounts(USER_ID),
      getRecentJobCount(24),
      getStaleApplications(USER_ID, 7),
    ]);

    const prefs = parseSearchPreferences(profile.search_preferences);

    return NextResponse.json({
      preferences: prefs,
      dashboard: {
        ...counts,
        recentJobsFetched24h: recentJobs,
        staleApplicationCount: stale.length,
      },
    });
  } catch (error) {
    return apiError(error, "cowork/dashboard-summary");
  }
}
