import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getSupabase } from "@/lib/supabase/client";
import { getResumeById, updateResume, getActiveJobsByIds } from "@/lib/supabase/queries";
import { getJobIdsByResumeId } from "@/lib/supabase/queries/scores";
import { parseCvText } from "@/lib/services/cv-parser";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";
import type { Json } from "@/types/database";
import { apiError } from "@/lib/api/error-response";
import { enforceAiRateLimit, parseJsonBody } from "@/lib/api/ai-route-helpers";

const MAX_RESCORE_JOBS = 10;

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

      if (resume.raw_text) {
        rawText = resume.raw_text;
      } else if (resume.file_type === "pdf") {
        // Download PDF from Storage and extract text on-demand
        const supabase = getSupabase();
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("resumes")
          .download(resume.file_path);
        if (downloadError || !fileData) {
          return NextResponse.json(
            { error: "Could not download PDF from storage." },
            { status: 500 }
          );
        }
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const { extractText } = await import("unpdf");
        const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
        rawText = text || "";
        if (!rawText.trim()) {
          return NextResponse.json(
            { error: "Could not extract text from PDF. Try uploading a .txt version." },
            { status: 422 }
          );
        }
        // Persist extracted text so future analyses are instant
        await updateResume(user.id, resumeId, { raw_text: rawText });
      } else {
        return NextResponse.json(
          { error: "No text available for this resume. Re-upload as a .txt file." },
          { status: 400 }
        );
      }
    } else {
      rawText = body.rawText;
    }

    const { parsed, tokensUsed } = await parseCvText(rawText);

    if (resumeId) {
      await updateResume(user.id, resumeId, {
        parsed_data: parsed as Json,
      });
    }

    // Fire-and-forget: re-score active jobs previously scored with this resume
    if (resumeId) {
      refreshScoresForResume(user.id, resumeId).catch((err) => {
        console.error("[analyze-cv] Score refresh failed:", err instanceof Error ? err.message : err);
      });
    }

    return NextResponse.json({ parsed, tokensUsed });
  } catch (error: unknown) {
    return apiError(error, "POST /api/ai/analyze-cv");
  }
}

async function refreshScoresForResume(userId: string, resumeId: string): Promise<void> {
  const jobIds = await getJobIdsByResumeId(userId, resumeId);
  if (jobIds.length === 0) return;

  const activeJobs = await getActiveJobsByIds(jobIds);
  if (activeJobs.length === 0) return;

  // Cap to avoid Vercel timeout (60s). Remaining jobs re-scored by next cron.
  const toRescore = activeJobs
    .slice(0, MAX_RESCORE_JOBS)
    .map((j) => ({ id: j.id, title: j.title, description: j.description }));

  console.log(`[analyze-cv] Re-scoring ${toRescore.length}/${activeJobs.length} active jobs for resume ${resumeId}`);

  await scoreJobsForProfile(userId, toRescore, resumeId);

  console.log(`[analyze-cv] Score refresh complete for resume ${resumeId}`);
}
