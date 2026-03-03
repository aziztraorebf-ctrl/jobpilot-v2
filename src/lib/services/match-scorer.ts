import { callStructured } from "@/lib/api/openai";
import { MatchScoreSchema, type MatchScore } from "@/lib/schemas/ai-responses";

interface CvSummary {
  skills: { technical: string[]; soft: string[]; languages: string[] };
  experience: { title: string; company: string; description: string }[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a job matching expert. Analyze the candidate's CV against the job description.
Score the match from 0-100 in these categories: overall, skills, experience, education.
Be honest and precise. List matching skills, missing skills, strengths, and concerns.
Respond in the same language as the job description.

CRITICAL RULE — Domain incompatibility:
If the job requires a core expertise that the candidate clearly does not have (e.g., the job is for a software developer, physician, lawyer, or engineer but the candidate has no background in that field), the overall_score MUST be 10 or below, regardless of soft skills or transferable qualities.
Soft skills (communication, leadership, organization) do NOT compensate for a missing core domain. A manager with no coding experience cannot fill a software engineering role. A non-doctor cannot fill a medical role.
Apply this rule strictly: domain mismatch = overall_score ≤ 10.`;

export function buildMatchPrompt(cvData: CvSummary, jobDescription: string): string {
  const skills = [
    ...cvData.skills.technical,
    ...cvData.skills.soft,
    ...cvData.skills.languages,
  ].join(", ") || "None listed";

  const experience = cvData.experience
    .map((e) => `${e.title} at ${e.company}: ${e.description}`)
    .join("\n") || "None listed";

  return `## Candidate CV Summary
${cvData.summary || "No summary available"}

### Skills
${skills}

### Experience
${experience}

---

## Job Description
${jobDescription}

---

Analyze the match between this candidate and this job.`;
}

export async function scoreMatch(
  cvData: CvSummary,
  jobDescription: string
): Promise<{ score: MatchScore; tokensUsed: number }> {
  const userPrompt = buildMatchPrompt(cvData, jobDescription);

  const result = await callStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: MatchScoreSchema,
    schemaName: "match_score",
  });

  return {
    score: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
  };
}
