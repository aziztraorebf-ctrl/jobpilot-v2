import { callStructured } from "@/lib/api/openai";
import { ParsedResumeSchema, type ParsedResume } from "@/lib/schemas/ai-responses";

const SYSTEM_PROMPT = `You are a CV/resume parser. Extract structured information from the provided resume text.
Be thorough and accurate. Do not invent or assume information not present in the text.
The user has pasted their CV as plain text. Parse it into the requested structure.
Return the data in the exact JSON structure requested.`;

export async function parseCvText(
  rawText: string
): Promise<{ parsed: ParsedResume; tokensUsed: number }> {
  if (!rawText.trim()) throw new Error("CV text is empty");

  const result = await callStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Parse this CV:\n\n${rawText}`,
    schema: ParsedResumeSchema,
    schemaName: "parsed_resume",
  });

  return {
    parsed: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
  };
}
