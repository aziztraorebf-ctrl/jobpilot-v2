import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type { Profile, ProfileUpdate };

/**
 * Fetch a single profile by user ID.
 * Throws if the Supabase query fails or no profile is found.
 */
export async function getProfile(userId: string): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
}

/**
 * Update a profile by user ID and return the updated row.
 * Throws if the Supabase query fails.
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data;
}

/**
 * Fetch profiles that have automatic search enabled (daily or weekly).
 * Returns profiles where notification_frequency is not "manual".
 */
export async function getProfilesWithAutoSearch(): Promise<Profile[]> {
  const supabase = getSupabase();
  // Fetch all profiles and filter in JS to avoid PostgREST JSONB operator issues
  const { data, error } = await supabase.from("profiles").select("*");

  if (error) {
    throw new Error(`Failed to fetch auto-search profiles: ${error.message}`);
  }

  return (data ?? []).filter((p) => {
    const freq = (p.search_preferences as Record<string, unknown> | null)
      ?.notification_frequency;
    return freq === "daily" || freq === "weekly";
  });
}

const MANUAL_SEARCH_LIMIT = 3;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export interface ManualSearchStatus {
  remaining: number;
  resetAt: string;
}

/**
 * Get remaining manual searches for user.
 * Resets counter if last reset was >24h ago.
 */
export async function getManualSearchStatus(userId: string): Promise<ManualSearchStatus> {
  const profile = await getProfile(userId);
  const resetAt = new Date(profile.manual_search_reset_at);
  const now = new Date();

  if (now.getTime() - resetAt.getTime() > RESET_WINDOW_MS) {
    await updateProfile(userId, {
      manual_search_count: 0,
      manual_search_reset_at: now.toISOString(),
    });
    return { remaining: MANUAL_SEARCH_LIMIT, resetAt: now.toISOString() };
  }

  const remaining = Math.max(0, MANUAL_SEARCH_LIMIT - profile.manual_search_count);
  return { remaining, resetAt: profile.manual_search_reset_at };
}

/**
 * Increment manual search counter. Throws "MANUAL_SEARCH_LIMIT_REACHED" if limit hit.
 */
export async function incrementManualSearch(userId: string): Promise<ManualSearchStatus> {
  const status = await getManualSearchStatus(userId);
  if (status.remaining === 0) {
    throw new Error("MANUAL_SEARCH_LIMIT_REACHED");
  }

  const profile = await getProfile(userId);
  const newCount = profile.manual_search_count + 1;
  await updateProfile(userId, { manual_search_count: newCount });

  return {
    remaining: Math.max(0, MANUAL_SEARCH_LIMIT - newCount),
    resetAt: status.resetAt,
  };
}
