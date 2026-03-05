import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/get-user";
import { getResumeById } from "@/lib/supabase/queries";
import { callStructured } from "@/lib/api/openai";
import { apiError } from "@/lib/api/error-response";
import { enforceAiRateLimit, parseJsonBody } from "@/lib/api/ai-route-helpers";
import {
  KeywordSuggestionsSchema,
  KeywordSuggestionsRequestSchema,
} from "@/lib/schemas/keyword-suggestions";
import type { ParsedResume } from "@/lib/schemas/ai-responses";

const SYSTEM_PROMPT = `You are a career advisor. Based on the candidate's resume, suggest the best job search keywords and preferences for their profile.

Rules:
- Suggest 3-8 specific job title keywords (in the same language as the CV, mix French and English variants if the CV is bilingual)
- Focus on roles the candidate is actually qualified for based on their experience
- Suggest locations only if inferable from the CV
- Suggest remote_preference based on the nature of their work history
- Write the rationale in the same language as the CV`;

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimited = enforceAiRateLimit(user.id);
    if (rateLimited) return rateLimited;

    const { data: raw, error: parseError } = await parseJsonBody(request);
    if (parseError) return parseError;

    const { resumeId } = KeywordSuggestionsRequestSchema.parse(raw);

    const resume = await getResumeById(user.id, resumeId);
    if (!resume || !resume.parsed_data) {
      return NextResponse.json(
        { error: "Resume not found or not yet analyzed" },
        { status: 404 }
      );
    }

    const cv = resume.parsed_data as unknown as ParsedResume;

    if (!cv.experience || !cv.skills) {
      return NextResponse.json(
        { error: "Resume data is stale, please re-analyze your CV" },
        { status: 422 }
      );
    }

    const cvSummary = [
      `Name: ${cv.personal?.name ?? "Unknown"}`,
      `Summary: ${cv.summary ?? ""}`,
      `Experience: ${(cv.experience ?? []).map((e) => `${e.title} at ${e.company}`).join(", ")}`,
      `Technical skills: ${(cv.skills.technical ?? []).join(", ")}`,
      `Soft skills: ${(cv.skills.soft ?? []).join(", ")}`,
      `Certifications: ${(cv.certifications ?? []).join(", ")}`,
      `Location from CV: ${cv.personal?.location ?? "Not specified"}`,
    ].join("\n");

    const result = await callStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: cvSummary,
      schema: KeywordSuggestionsSchema,
      schemaName: "keyword_suggestions",
    });

    return NextResponse.json({
      suggestions: result.data,
      tokensUsed: result.tokensInput + result.tokensOutput,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/suggest-keywords");
  }
}
