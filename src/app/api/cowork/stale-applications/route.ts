import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getStaleApplications, getProfilesWithAutoSearch } from "@/lib/supabase/queries";

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

    const stale = await getStaleApplications(userId, days);

    return NextResponse.json({ count: stale.length, applications: stale });
  } catch (error) {
    return apiError(error, "cowork/stale-applications");
  }
}
