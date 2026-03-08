import { getPrimaryResume, getResumeById } from "@/lib/supabase/queries/resumes";
import { scoreMatch } from "@/lib/services/match-scorer";
import { upsertScore } from "@/lib/supabase/queries/scores";
import { extractCvData } from "@/lib/api/ai-route-helpers";

interface JobToScore {
  id: string;
  description: string | null;
  title: string;
}

/**
 * Scores a list of jobs against a specific resume (or the primary resume if none specified).
 * Returns a map of jobId -> overall_score for successfully scored jobs.
 * Skips gracefully if no resume or if individual jobs fail.
 */
export async function scoreJobsForProfile(
  userId: string,
  jobs: JobToScore[],
  resumeId?: string
): Promise<Record<string, number>> {
  if (jobs.length === 0) return {};

  const resume = resumeId
    ? await getResumeById(userId, resumeId)
    : await getPrimaryResume(userId);
  if (!resume || !resume.parsed_data || typeof resume.parsed_data !== "object") {
    return {};
  }

  const cvData = extractCvData(resume.parsed_data as Record<string, unknown>);
  const scoreMap: Record<string, number> = {};

  for (const job of jobs) {
    if (!job.description) continue;
    try {
      const { score } = await scoreMatch(cvData, job.description);
      await upsertScore({
        user_id: userId,
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
      scoreMap[job.id] = score.overall_score;
    } catch {
      console.error(`[auto-scorer] Failed to score job ${job.id} for user ${userId}`);
    }
  }

  return scoreMap;
}
