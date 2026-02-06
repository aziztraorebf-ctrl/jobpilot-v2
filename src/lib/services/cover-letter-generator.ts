import { callStructured } from "@/lib/api/openai";
import { CoverLetterResponseSchema, type CoverLetterResponse } from "@/lib/schemas/ai-responses";

export interface GenerateOptions {
  cvSummary: string;
  cvSkills: string[];
  cvExperience: string;
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  language: "fr" | "en";
  tone: "professional" | "enthusiastic" | "creative" | "formal";
}

export interface CoverLetterResult {
  letter: CoverLetterResponse;
  tokensUsed: number;
  integrityWarnings: string[];
}

// Common tech skills used for anti-hallucination cross-reference.
// If the generated letter mentions one of these but it is NOT in the CV,
// we flag it as a potential hallucination.
const COMMON_SKILLS = [
  "python", "java", "javascript", "typescript", "react", "angular", "vue",
  "node", "sql", "nosql", "mongodb", "postgresql", "aws", "azure", "gcp",
  "docker", "kubernetes", "terraform", "ci/cd", "agile", "scrum",
  "machine learning", "deep learning", "tensorflow", "pytorch",
  "tableau", "power bi", "excel", "sas", "r", "scala", "spark",
];

export function checkIntegrity(
  letterText: string,
  cvSkills: string[],
  cvExperience: string
): string[] {
  const warnings: string[] = [];
  const letterLower = letterText.toLowerCase();
  const cvContent = [
    ...cvSkills.map((s) => s.toLowerCase()),
    cvExperience.toLowerCase(),
  ].join(" ");

  for (const skill of COMMON_SKILLS) {
    if (letterLower.includes(skill) && !cvContent.includes(skill)) {
      warnings.push(`"${skill}" mentioned in cover letter but not found in CV`);
    }
  }

  return warnings;
}

export async function generateCoverLetter(
  options: GenerateOptions
): Promise<CoverLetterResult> {
  const systemPrompt = `You are an expert cover letter writer.
Write a personalized cover letter based on the candidate's real experience and skills.
CRITICAL RULE: NEVER invent experience, skills, or qualifications not present in the CV.
Only reorganize and emphasize existing relevant experience.
If the candidate lacks a required skill, do NOT mention it. Focus on transferable skills instead.
Language: ${options.language === "fr" ? "French" : "English"}.
Tone: ${options.tone}.`;

  const userPrompt = `## Candidate Profile
Summary: ${options.cvSummary}
Key Skills: ${options.cvSkills.join(", ")}
Experience: ${options.cvExperience}

## Target Job
Title: ${options.jobTitle}
Company: ${options.companyName}
Description: ${options.jobDescription}

Write a compelling cover letter for this specific job. ONLY reference skills and experience listed above.`;

  const result = await callStructured({
    systemPrompt,
    userPrompt,
    schema: CoverLetterResponseSchema,
    schemaName: "cover_letter",
  });

  const integrityWarnings = checkIntegrity(
    result.data.full_text,
    options.cvSkills,
    options.cvExperience
  );

  return {
    letter: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
    integrityWarnings,
  };
}
