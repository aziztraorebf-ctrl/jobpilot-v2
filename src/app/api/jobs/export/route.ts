import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/get-user";
import { getSupabase } from "@/lib/supabase/client";
import { getScoreMap } from "@/lib/supabase/queries";
import { generateJobsCsv } from "@/lib/utils/csv-export";
import { apiError } from "@/lib/api/error-response";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 30);
    const minScore = parseInt(searchParams.get("minScore") ?? "0");
    const profileLabel = searchParams.get("profile") ?? null;

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
    const scoreMap = jobIds.length > 0 ? await getScoreMap(user.id, jobIds) : {};

    const filtered = (jobs ?? [])
      .filter((j) => j.fetched_at != null)
      .map((j) => ({ ...j, fetched_at: j.fetched_at as string, score: scoreMap[j.id] ?? 0 }))
      .filter((j) => j.score >= minScore);

    const csv = generateJobsCsv(filtered);
    const bom = "\uFEFF";
    const filename = `jobpilot-offres-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8;",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error, "GET /api/jobs/export");
  }
}
