import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getResumeById, updateResume } from "@/lib/supabase/queries";
import { parseCvText } from "@/lib/services/cv-parser";
import type { Json } from "@/types/database";
import { apiError } from "@/lib/api/error-response";
import { enforceAiRateLimit, parseJsonBody } from "@/lib/api/ai-route-helpers";

const AnalyzeCvBody = z.union([
  z.object({ resumeId: z.string().uuid("resumeId must be a valid UUID") }),
  z.object({ rawText: z.string().min(50, "CV text must be at least 50 characters") }),
]);

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimited = enforceAiRateLimit(user.id);
    if (rateLimited) return rateLimited;

    const { data: raw, error: parseError } = await parseJsonBody(request);
    if (parseError) return parseError;

    const body = AnalyzeCvBody.parse(raw);

    let rawText: string;
    let resumeId: string | null = null;

    if ("resumeId" in body) {
      resumeId = body.resumeId;
      const resume = await getResumeById(user.id, body.resumeId);
      if (!resume) {
        return NextResponse.json({ error: "Resume not found" }, { status: 404 });
      }
      if (!resume.raw_text) {
        return NextResponse.json(
          { error: "Resume has no raw text. Upload a .txt file or re-parse." },
          { status: 400 }
        );
      }
      rawText = resume.raw_text;
    } else {
      rawText = body.rawText;
    }

    const { parsed, tokensUsed } = await parseCvText(rawText);

    if (resumeId) {
      await updateResume(user.id, resumeId, {
        parsed_data: parsed as Json,
      });
    }

    return NextResponse.json({ parsed, tokensUsed });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/analyze-cv");
  }
}
