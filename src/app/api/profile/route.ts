import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile, updateProfile } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { apiError } from "@/lib/api/error-response";

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

    const body = ProfilePatchSchema.parse(raw);

    // Reject empty updates (no fields provided)
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const updated = await updateProfile(user.id, body);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiError(error, "PATCH /api/profile");
  }
}
