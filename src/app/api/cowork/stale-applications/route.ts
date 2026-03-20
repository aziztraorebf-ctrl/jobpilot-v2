import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getStaleApplications } from "@/lib/supabase/queries";
import { USER_ID } from "@/lib/supabase/constants";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "7", 10);

    const stale = await getStaleApplications(USER_ID, days);

    return NextResponse.json({ count: stale.length, applications: stale });
  } catch (error) {
    return apiError(error, "cowork/stale-applications");
  }
}
