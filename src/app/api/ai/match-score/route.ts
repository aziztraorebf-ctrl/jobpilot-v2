import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getJobById, getResumeById, upsertScore } from "@/lib/supabase/queries";
import { scoreMatch } from "@/lib/services/match-scorer";
import { apiError } from "@/lib/api/error-response";
import { enforceAiRateLimit, parseJsonBody, extractCvData } from "@/lib/api/ai-route-helpers";

const MatchScoreBody = z.object({
  jobId: z.string().uuid("jobId must be a valid UUID"),
  resumeId: z.string().uuid("resumeId must be a valid UUID"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimited = enforceAiRateLimit(user.id);
    if (rateLimited) return rateLimited;

    const { data: raw, error: parseError } = await parseJsonBody(request);
    if (parseError) return parseError;

    const body = MatchScoreBody.parse(raw);

    const [job, resume] = await Promise.all([
      getJobById(body.jobId),
      getResumeById(user.id, body.resumeId),
    ]);

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    if (!resume.parsed_data || typeof resume.parsed_data !== "object") {
      return NextResponse.json(
        { error: "Resume not yet analyzed. Call /api/ai/analyze-cv first." },
        { status: 400 }
      );
    }
    if (!job.description) {
      return NextResponse.json(
        { error: "Job has no description to match against" },
        { status: 400 }
      );
    }

    const cvData = extractCvData(resume.parsed_data as Record<string, unknown>);

    const { score, tokensUsed } = await scoreMatch(cvData, job.description);

    const savedScore = await upsertScore({
      user_id: user.id,
      job_listing_id: body.jobId,
      resume_id: body.resumeId,
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

    return NextResponse.json({ score: savedScore, tokensUsed });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/match-score");
  }
}
