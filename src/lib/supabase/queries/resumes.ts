import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ResumeInsert = Database["public"]["Tables"]["resumes"]["Insert"];
type ResumeUpdate = Database["public"]["Tables"]["resumes"]["Update"];

export type { ResumeRow, ResumeInsert, ResumeUpdate };

/**
 * Fetch the primary resume (is_primary=true) for the current user.
 * Returns null if no primary resume exists.
 */
export async function getPrimaryResume(userId: string): Promise<ResumeRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch primary resume: ${error.message}`);
  }

  return data;
}

/**
 * Fetch a single resume by ID (must belong to current user).
 * Returns null if not found.
 */
export async function getResumeById(userId: string, id: string): Promise<ResumeRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch resume by ID: ${error.message}`);
  }

  return data;
}

/**
 * List all resumes for the current user, ordered by created_at DESC.
 */
export async function getResumes(userId: string): Promise<ResumeRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch resumes: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Unset is_primary on all resumes for the current user.
 * Used internally before setting a new primary.
 */
async function unsetAllPrimaries(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("resumes")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("is_primary", true);

  if (error) {
    throw new Error(`Failed to unset primary resumes: ${error.message}`);
  }
}

/**
 * Insert a new resume for the current user.
 * If is_primary is true, first unsets all other primaries.
 * Returns the created row.
 */
export async function createResume(userId: string, data: Omit<ResumeInsert, "user_id">): Promise<ResumeRow> {
  if (data.is_primary) {
    await unsetAllPrimaries(userId);
  }

  const supabase = getSupabase();
  const { data: created, error } = await supabase
    .from("resumes")
    .insert({ ...data, user_id: userId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create resume: ${error.message}`);
  }

  return created;
}

/**
 * Update a resume by ID.
 * If setting is_primary=true, first unsets all other primaries.
 * Returns the updated row.
 */
export async function updateResume(
  userId: string,
  id: string,
  data: ResumeUpdate
): Promise<ResumeRow> {
  if (data.is_primary) {
    await unsetAllPrimaries(userId);
  }

  const supabase = getSupabase();
  const { data: updated, error } = await supabase
    .from("resumes")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update resume: ${error.message}`);
  }

  return updated;
}

/**
 * Delete a resume by ID.
 */
export async function deleteResume(userId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete resume: ${error.message}`);
  }
}
