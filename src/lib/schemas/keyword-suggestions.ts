import { z } from "zod";

export const KeywordSuggestionsSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1).max(10),
  locations: z.array(z.string()).max(5),
  remote_preference: z.enum(["remote", "hybrid", "any"]),
  rationale: z.string(),
});

export const KeywordSuggestionsRequestSchema = z.object({
  resumeId: z.string().uuid(),
});

export type KeywordSuggestions = z.infer<typeof KeywordSuggestionsSchema>;
