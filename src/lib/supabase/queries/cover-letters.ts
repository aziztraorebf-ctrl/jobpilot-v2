import { getSupabase } from "@/lib/supabase/client";
import { getAuthBrowserClient } from "@/lib/supabase/browser-client";
import type { Database } from "@/types/database";

type CoverLetterRow = Database["public"]["Tables"]["cover_letters"]["Row"];
type CoverLetterInsert = Database["public"]["Tables"]["cover_letters"]["Insert"];

export type { CoverLetterRow, CoverLetterInsert };

/** Subset of cover letter fields returned by the client-side query. */
export interface CoverLetterClientRow {
  id: string;
  content: string;
  integrity_warnings: string[] | null;
  language: "fr" | "en";
  tone: "professional" | "enthusiastic" | "creative" | "formal";
}

/**
 * Fetch the most recent cover letter for a specific job, regardless of resume.
 * Returns the latest cover_letters row or null if none exists.
 */
export async function getLatestCoverLetter(
  userId: string,
  jobId: string
): Promise<CoverLetterRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cover_letters")
    .select("*")
    .eq("user_id", userId)
    .eq("job_listing_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest cover letter: ${error.message}`);
  }

  return data;
}

/**
 * Client-side: fetch the most recent cover letter for a job.
 * Uses the browser Supabase client (requires authenticated session).
 */
export async function getLatestCoverLetterClient(
  jobId: string
): Promise<CoverLetterClientRow | null> {
  const supabase = getAuthBrowserClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .select("id, content, integrity_warnings, language, tone")
    .eq("job_listing_id", jobId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest cover letter: ${error.message}`);
  }

  return data as CoverLetterClientRow | null;
}

/**
 * Client-side: update a cover letter's content and integrity warnings.
 * Marks the letter as edited and updates the timestamp.
 */
export async function updateCoverLetter(
  id: string,
  content: string,
  integrityWarnings: string[] | null
): Promise<void> {
  const supabase = getAuthBrowserClient();
  const { error } = await supabase
    .from("cover_letters")
    .update({
      content,
      integrity_warnings: integrityWarnings,
      is_edited: true,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update cover letter: ${error.message}`);
  }
}
