import { z } from "zod";

export const SearchProfileSchema = z.object({
  resume_id: z.string().uuid().nullable(),
  keywords: z.array(z.string().min(1)).min(1).max(20),
  label: z.string().min(1).max(50),
});

export const RotationPrefsSchema = z.object({
  rotation_profiles: z.array(SearchProfileSchema).min(1).max(2),
  active_profile_index: z.number().int().min(0).max(1).default(0),
  rotation_enabled: z.boolean().default(false),
  rotation_days: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  last_rotation_at: z.string().datetime().nullable().default(null),
});

export type SearchProfile = z.infer<typeof SearchProfileSchema>;
export type RotationPrefs = z.infer<typeof RotationPrefsSchema>;
