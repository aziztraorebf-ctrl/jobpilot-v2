import { callStructured } from "@/lib/api/openai";
import { CareerChatResponseSchema, type CareerChatResponse } from "@/lib/schemas/ai-responses";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CVContext {
  summary: string;
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
  };
  experience: Array<{
    title: string;
    company: string;
    start_date: string;
    end_date: string | null;
    description: string;
    achievements: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    field: string | null;
  }>;
}

export interface CareerChatOptions {
  userMessage: string;
  cvContext: CVContext;
  conversationHistory: ConversationMessage[];
  language: "fr" | "en";
}

export interface CareerChatResult {
  response: CareerChatResponse;
  tokensUsed: number;
}

function buildCVSummary(cv: CVContext): string {
  const skillsList = [
    ...cv.skills.technical,
    ...cv.skills.soft,
  ].join(", ");

  const experienceSummary = cv.experience
    .map((exp) => `${exp.title} at ${exp.company} (${exp.start_date} - ${exp.end_date || "Present"})`)
    .join("; ");

  const educationSummary = cv.education
    .map((edu) => `${edu.degree} from ${edu.institution} (${edu.year})${edu.field ? ` in ${edu.field}` : ""}`)
    .join("; ");

  return `
## Candidate Profile
Summary: ${cv.summary}
Skills: ${skillsList}
Experience: ${experienceSummary}
Education: ${educationSummary}
`.trim();
}

function buildConversationContext(history: ConversationMessage[]): string {
  if (history.length === 0) {
    return "";
  }

  const historyText = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n\n");

  return `\n\n## Previous Conversation\n${historyText}`;
}

export async function sendCareerChatMessage(
  options: CareerChatOptions
): Promise<CareerChatResult> {
  const lang = options.language === "fr" ? "French" : "English";

  const systemPrompt = `You are an expert career advisor helping job seekers understand their career options and skill development.

Your role:
- Analyze the candidate's CV to identify transferable skills and potential career paths
- Suggest career directions based on their actual experience (NEVER invent skills they don't have)
- Recommend specific upskilling opportunities to bridge skill gaps
- Provide actionable job search strategy advice
- Be encouraging but realistic about career transitions

CRITICAL RULES:
- ONLY reference skills, experience, and education present in the candidate's CV
- If the candidate asks about a field they have no experience in, focus on transferable skills
- Provide 2-3 specific, actionable career suggestions when relevant
- Suggest 2-3 concrete skill recommendations when discussing skill gaps
- Include 1-2 follow-up prompts to guide the conversation

Language: ${lang}
Tone: Professional, supportive, and encouraging`;

  const cvSummary = buildCVSummary(options.cvContext);
  const conversationContext = buildConversationContext(options.conversationHistory);

  const userPrompt = `${cvSummary}${conversationContext}

## Current Question
${options.userMessage}

Provide helpful career guidance based on the candidate's actual background.`;

  const result = await callStructured({
    systemPrompt,
    userPrompt,
    schema: CareerChatResponseSchema,
    schemaName: "career_chat_response",
  });

  return {
    response: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
  };
}
