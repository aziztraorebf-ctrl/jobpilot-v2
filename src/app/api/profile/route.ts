import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile, updateProfile } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { apiError } from "@/lib/api/error-response";
import { migrateToProfiles } from "@/lib/utils/search-profile-helpers";

// -- Zod schema for PATCH body validation --

const SearchPreferencesSchema = z.object({
  keywords: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  salary_min: z.number().int().min(0).optional(),
  salary_currency: z.string().min(1).max(10).optional(),
  remote_preference: z.enum(["remote", "hybrid", "any"]).optional(),
  notification_frequency: z.enum(["manual", "daily", "weekly"]).optional(),
  notification_hour: z.number().int().min(0).max(23).optional(),
  alert_threshold: z.number().int().min(0).max(100).optional(),
  alert_new_jobs: z.boolean().optional(),
  alert_follow_up: z.boolean().optional(),
  alert_weekly_summary: z.boolean().optional(),
  rotation_profiles: z.array(z.object({
    resume_id: z.string().uuid().nullable(),
    keywords: z.array(z.string().min(1)).min(1).max(20),
    label: z.string().min(1).max(50),
  })).optional(),
  active_profile_index: z.number().int().min(0).max(1).optional(),
  rotation_enabled: z.boolean().optional(),
  rotation_days: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  last_rotation_at: z.string().datetime().nullable().optional(),
});

const ProfilePatchSchema = z
  .object({
    full_name: z.string().min(1).max(200).optional(),
    preferred_language: z.enum(["fr", "en"]).optional(),
    search_preferences: SearchPreferencesSchema.optional(),
  })
  .strict();

// -- GET /api/profile --

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    return NextResponse.json(profile);
  } catch (error: unknown) {
    return apiError(error, "GET /api/profile");
  }
}

// -- PATCH /api/profile --

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    let body = ProfilePatchSchema.parse(raw);

    // Enforce max 2 rotation profiles
    if (
      body.search_preferences?.rotation_profiles &&
      body.search_preferences.rotation_profiles.length > 2
    ) {
      return NextResponse.json(
        { error: "Maximum 2 rotation profiles allowed" },
        { status: 400 }
      );
    }

    // Reject empty updates (no fields provided)
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    // Auto-migrate existing search_preferences to rotation_profiles format
    if (body.search_preferences) {
      const currentProfile = await getProfile(user.id);
      const currentPrefs = (currentProfile.search_preferences ?? {}) as Record<string, unknown>;
      const migrated = migrateToProfiles(currentPrefs);
      const merged = { ...migrated, ...body.search_preferences };
      body = {
        ...body,
        search_preferences: SearchPreferencesSchema.parse(merged),
      };
    }

    const updated = await updateProfile(user.id, body);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiError(error, "PATCH /api/profile");
  }
}
