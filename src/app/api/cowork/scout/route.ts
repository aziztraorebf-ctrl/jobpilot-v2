import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { upsertJobs, getProfilesWithAutoSearch, getProfile, markJobSeen } from "@/lib/supabase/queries";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";
import { runScout, type ScoutInput } from "@/lib/services/scout";
import { parseSearchPreferences } from "@/types/search-preferences";

const BodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("targets"),
    urls: z.array(z.string().url()).min(1).max(20),
  }),
  z.object({
    mode: z.literal("search"),
    keywords: z.string().min(1),
    location: z.string().optional(),
    limit: z.number().min(1).max(20).optional(),
  }),
  z.object({
    mode: z.literal("agent"),
    prompt: z.string().min(10),
    urls: z.array(z.string().url()).optional(),
    maxCredits: z.number().min(5).max(100).optional(),
  }),
]);

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const raw = await request.json();
    const body = BodySchema.parse(raw);

    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ error: "No profiles found" }, { status: 404 });
    }
    const userId = profiles[0].id;
    const profile = await getProfile(userId);
    const prefs = parseSearchPreferences(profile.search_preferences);

    // Step 1: Run scout
    const scoutResult = await runScout(body as ScoutInput);

    if (scoutResult.jobs.length === 0) {
      return NextResponse.json({
        mode: body.mode,
        discovered: 0,
        inserted: 0,
        scored: 0,
        topMatches: [],
        errors: scoutResult.errors,
        creditsUsed: scoutResult.creditsUsed,
      });
    }

    // Step 2: Tag jobs with profile label and upsert
    const activeIdx = prefs.active_profile_index ?? 0;
    const activeLabel =
      prefs.rotation_profiles?.[activeIdx]?.label || "scout";
    const activeResumeId =
      prefs.rotation_profiles?.[activeIdx]?.resume_id || undefined;

    const taggedJobs = scoutResult.jobs.map((j) => ({
      ...j,
      profile_label: activeLabel,
    }));

    const rows = await upsertJobs(taggedJobs);
    const inserted = rows.length;

    // Step 3: Score ALL inserted jobs (scout brings fewer, more targeted results)
    const toScore = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
    }));

    let topMatches: { title: string; company: string | null; score: number }[] = [];

    if (toScore.length > 0) {
      const scores = await scoreJobsForProfile(userId, toScore, activeResumeId);

      // Auto-mark scored jobs as seen
      for (const row of rows) {
        try {
          await markJobSeen(userId, row.id);
        } catch {
          // Best-effort
        }
      }

      topMatches = rows
        .filter((r) => scores[r.id] !== undefined)
        .map((r) => ({
          title: r.title,
          company: r.company_name,
          score: scores[r.id],
        }))
        .sort((a, b) => b.score - a.score);
    }

    return NextResponse.json({
      mode: body.mode,
      discovered: scoutResult.jobs.length,
      inserted,
      scored: topMatches.length,
      topMatches,
      errors: scoutResult.errors,
      creditsUsed: scoutResult.creditsUsed,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, "cowork/scout");
    }
    return apiError(error, "cowork/scout");
  }
}
