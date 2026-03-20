import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";
import { upsertJobs, getProfile } from "@/lib/supabase/queries";
import { parseSearchPreferences } from "@/types/search-preferences";
import { USER_ID } from "@/lib/supabase/constants";

const MAX_JOBS_TO_SCORE = 5;

const BodySchema = z
  .object({
    keywords: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    sources: z
      .array(z.enum(["jsearch", "adzuna"]))
      .min(1)
      .optional(),
  })
  .optional();

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    // Parse optional body (may be empty for auto-search)
    let body: z.infer<typeof BodySchema> = undefined;
    try {
      const raw = await request.json();
      body = BodySchema.parse(raw);
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        return apiError(e, "cowork/fetch-and-score");
      }
      // Empty body is fine - we'll use profile preferences
    }

    // Load profile preferences as fallback
    const profile = await getProfile(USER_ID);
    const prefs = parseSearchPreferences(profile.search_preferences);

    const keywords = body?.keywords ?? prefs.keywords.join(" ");
    if (!keywords) {
      return NextResponse.json(
        { error: "No keywords provided and no keywords in profile preferences" },
        { status: 400 }
      );
    }

    const location = body?.location ?? prefs.locations[0] ?? "Canada";
    const sources = body?.sources ?? prefs.sources;

    // Step 1: Fetch jobs
    const searchResult = await aggregateJobSearch({
      keywords: prefs.remote_only ? `${keywords} remote` : keywords,
      location,
      sources,
    });

    // Step 2: Upsert into DB
    let inserted = 0;
    if (searchResult.jobs.length > 0) {
      const rows = await upsertJobs(searchResult.jobs);
      inserted = rows.length;
    }

    // Step 3: Score top N jobs using v2's auto-scorer
    const toScore = searchResult.jobs.slice(0, MAX_JOBS_TO_SCORE);
    const jobsForScoring = toScore.map((j) => ({
      id: j.dedup_hash,
      description: j.description,
      title: j.title,
    }));

    const scores = await scoreJobsForProfile(USER_ID, jobsForScoring);

    const topMatches = toScore
      .filter((j) => scores[j.dedup_hash] !== undefined)
      .map((j) => ({
        title: j.title,
        company: j.company_name,
        score: scores[j.dedup_hash],
      }));

    return NextResponse.json({
      fetched: searchResult.jobs.length,
      inserted,
      scored: topMatches.length,
      topMatches,
      errors: searchResult.errors,
    });
  } catch (error) {
    return apiError(error, "cowork/fetch-and-score");
  }
}
