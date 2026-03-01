import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/get-user";
import { getSupabase } from "@/lib/supabase/client";
import { getPrimaryResume, getResumes } from "@/lib/supabase/queries/resumes";
import { upsertScore } from "@/lib/supabase/queries/scores";
import { scoreMatch } from "@/lib/services/match-scorer";
import { extractCvData } from "@/lib/api/ai-route-helpers";
import { apiError } from "@/lib/api/error-response";

const BATCH_SIZE = 5;

export async function POST() {
  try {
    const user = await requireUser();

    // Use primary resume, falling back to the most recent analyzed resume
    let resume = await getPrimaryResume(user.id);
    if (!resume) {
      const all = await getResumes(user.id);
      resume = all.find((r) => r.parsed_data !== null) ?? null;
    }
    if (!resume) {
      return NextResponse.json({ error: "NO_RESUME", scored: 0 }, { status: 400 });
    }
    if (!resume.parsed_data || typeof resume.parsed_data !== "object") {
      return NextResponse.json({ error: "RESUME_NOT_ANALYZED", scored: 0 }, { status: 400 });
    }

    const cvData = extractCvData(resume.parsed_data as Record<string, unknown>);

    const supabase = getSupabase();

    // Get already-scored job IDs for this user+resume
    const { data: existingScores, error: scoresError } = await supabase
      .from("match_scores")
      .select("job_listing_id")
      .eq("user_id", user.id)
      .eq("resume_id", resume.id);

    if (scoresError) {
      return NextResponse.json({ error: scoresError.message, scored: 0 }, { status: 500 });
    }

    const scoredJobIds = new Set((existingScores ?? []).map((r) => r.job_listing_id));

    // Fetch active jobs, then filter out already-scored ones
    const { data: allJobs, error: jobsError } = await supabase
      .from("job_listings")
      .select("id, description, title")
      .eq("is_active", true)
      .limit(BATCH_SIZE + scoredJobIds.size);

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message, scored: 0 }, { status: 500 });
    }

    const jobsToScore = (allJobs ?? [])
      .filter((j) => !scoredJobIds.has(j.id))
      .slice(0, BATCH_SIZE);

    if (jobsToScore.length === 0) {
      return NextResponse.json({ scored: 0, newScores: {} });
    }

    const newScores: Record<string, number> = {};
    let scored = 0;

    for (const job of jobsToScore) {
      if (!job.description) continue;
      try {
        const { score } = await scoreMatch(cvData, job.description);
        await upsertScore({
          user_id: user.id,
          job_listing_id: job.id,
          resume_id: resume.id,
          overall_score: score.overall_score,
          skill_match_score: score.skill_match_score,
          experience_match_score: score.experience_match_score,
          education_match_score: score.education_match_score,
          explanation: score.explanation,
          matching_skills: score.matching_skills,
          missing_skills: score.missing_skills,
          strengths: score.strengths,
          concerns: score.concerns,
        });
        newScores[job.id] = score.overall_score;
        scored++;
      } catch {
        // Skip individual job scoring failures silently
      }
    }

    return NextResponse.json({ scored, newScores });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/score-jobs");
  }
}
