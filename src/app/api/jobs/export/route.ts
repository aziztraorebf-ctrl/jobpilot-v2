import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/get-user";
import { getSupabase } from "@/lib/supabase/client";
import { getScoreMap, getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import { generateJobsCsv } from "@/lib/utils/csv-export";
import { generateJobsJson } from "@/lib/utils/json-export";
import { apiError } from "@/lib/api/error-response";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let userId: string;
    if (isCronCall) {
      const profiles = await getProfilesWithAutoSearch();
      if (profiles.length === 0) {
        return NextResponse.json({ error: "No profiles found" }, { status: 404 });
      }
      userId = profiles[0].id;
    } else {
      const user = await getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }
    const { searchParams } = new URL(request.url);
    const daysRaw = parseInt(searchParams.get("days") ?? "7");
    const days = Math.min(isNaN(daysRaw) ? 7 : daysRaw, 30);
    const minScoreRaw = parseInt(searchParams.get("minScore") ?? "60");
    const minScore = isNaN(minScoreRaw) ? 60 : minScoreRaw;
    const profileLabel = searchParams.get("profile") ?? null;
    const format = searchParams.get("format") ?? "csv"; // "csv" | "json"

    const supabase = getSupabase();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("job_listings")
      .select("id, title, company_name, location, source_url, remote_type, description, fetched_at, profile_label")
      .eq("is_active", true)
      .gte("fetched_at", since)
      .order("fetched_at", { ascending: false })
      .limit(500);

    if (profileLabel) {
      query = query.eq("profile_label", profileLabel);
    }

    const { data: jobs, error } = await query;
    if (error) throw new Error(error.message);

    const jobIds = (jobs ?? []).map((j) => j.id);
    const scoreMap = jobIds.length > 0 ? await getScoreMap(userId, jobIds) : {};

    const filtered = (jobs ?? [])
      .filter((j) => j.fetched_at != null)
      .map((j) => ({
        ...j,
        fetched_at: j.fetched_at as string,
        score: scoreMap[j.id] ?? 0,
        profile_label: j.profile_label ?? null,
      }))
      .filter((j) => j.score >= minScore)
      .sort((a, b) => b.score - a.score);

    // Sanitize profile name for filename (accents + special chars)
    const profileSlug = profileLabel
      ? profileLabel
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9-]/g, "-")
          .toLowerCase()
      : null;

    const dateStr = new Date().toISOString().split("T")[0];
    const baseFilename = [
      "jobpilot",
      `${days}j`,
      profileSlug,
      `${filtered.length}offres`,
      dateStr,
    ]
      .filter(Boolean)
      .join("-");

    if (format === "json") {
      const json = generateJobsJson(filtered);
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json;charset=utf-8;",
          "Content-Disposition": `attachment; filename="${baseFilename}.json"`,
        },
      });
    }

    const csv = generateJobsCsv(filtered);
    const bom = "\uFEFF";

    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8;",
        "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
      },
    });
  } catch (error) {
    return apiError(error, "GET /api/jobs/export");
  }
}
