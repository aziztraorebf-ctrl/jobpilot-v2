import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getJobById, getResumeById } from "@/lib/supabase/queries";
import {
  generateCoverLetter,
  type GenerateOptions,
} from "@/lib/services/cover-letter-generator";
import { getSupabase } from "@/lib/supabase/client";
import { apiError } from "@/lib/api/error-response";
import { enforceAiRateLimit, parseJsonBody, extractCvData } from "@/lib/api/ai-route-helpers";

const CoverLetterBody = z.object({
  jobId: z.string().uuid("jobId must be a valid UUID"),
  resumeId: z.string().uuid("resumeId must be a valid UUID"),
  language: z.enum(["fr", "en"]).default("fr"),
  tone: z
    .enum(["professional", "enthusiastic", "creative", "formal"])
    .default("professional"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimited = enforceAiRateLimit(user.id);
    if (rateLimited) return rateLimited;

    const { data: raw, error: parseError } = await parseJsonBody(request);
    if (parseError) return parseError;

    const body = CoverLetterBody.parse(raw);

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
        { error: "Job has no description" },
        { status: 400 }
      );
    }

    const cvData = extractCvData(resume.parsed_data as Record<string, unknown>);

    const options: GenerateOptions = {
      cvSummary: cvData.summary,
      cvSkills: [...cvData.skills.technical, ...cvData.skills.soft, ...cvData.skills.languages],
      cvExperience: cvData.experience
        .map((e) => `${e.title} at ${e.company}: ${e.description}`)
        .join("\n"),
      jobTitle: job.title,
      jobDescription: job.description,
      companyName: job.company_name ?? "Unknown Company",
      language: body.language,
      tone: body.tone,
    };

    const result = await generateCoverLetter(options);

    // Save to cover_letters table
    let savedId: string | null = null;
    try {
      const supabase = getSupabase();
      const { data: saved } = await supabase
        .from("cover_letters")
        .insert({
          user_id: user.id,
          job_listing_id: body.jobId,
          resume_id: body.resumeId,
          content: result.letter.full_text,
          language: body.language,
          tone: body.tone,
        })
        .select("id")
        .single();

      savedId = saved?.id ?? null;
    } catch (dbError) {
      console.error("[API] Failed to save cover letter:", dbError);
    }

    return NextResponse.json({
      letter: result.letter,
      tokensUsed: result.tokensUsed,
      integrityWarnings: result.integrityWarnings,
      savedId,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/cover-letter");
  }
}
