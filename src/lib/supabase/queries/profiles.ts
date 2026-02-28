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
