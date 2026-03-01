import { z } from "zod";

// -- Match Score (CV vs Job scoring result) --
export const MatchScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  skill_match_score: z.number().int().min(0).max(100),
  experience_match_score: z.number().int().min(0).max(100),
  education_match_score: z.number().int().min(0).max(100),
  explanation: z.string().max(500),
  matching_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  strengths: z.array(z.string().max(200)),
  concerns: z.array(z.string().max(200)),
});

export type MatchScore = z.infer<typeof MatchScoreSchema>;

// -- Parsed Resume (AI-extracted structure from plain text CV) --
export const ParsedResumeSchema = z.object({
  personal: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    linkedin: z.string().nullable(),
  }),
  summary: z.string(),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
    languages: z.array(z.string()),
  }),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      start_date: z.string(),
      end_date: z.string().nullable(),
      description: z.string(),
      achievements: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string(),
      field: z.string().nullable(),
    })
  ),
  certifications: z.array(z.string()).nullable(),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

// -- Cover Letter Response (AI-generated cover letter) --
export const CoverLetterResponseSchema = z.object({
  subject: z.string(),
  greeting: z.string(),
  body: z.string(),
  closing: z.string(),
  full_text: z.string(),
});

export type CoverLetterResponse = z.infer<typeof CoverLetterResponseSchema>;

// -- Career Chat Response (AI conversational response for career guidance) --
export const CareerChatResponseSchema = z.object({
  message: z.string(),
  tokens_used: z.number().int().min(0),
  career_suggestions: z.array(z.string()).optional(),
  skill_recommendations: z.array(z.string()).optional(),
  follow_up_prompts: z.array(z.string()).optional(),
});

export type CareerChatResponse = z.infer<typeof CareerChatResponseSchema>;
