import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type CoverLetterRow = Database["public"]["Tables"]["cover_letters"]["Row"];
type CoverLetterInsert = Database["public"]["Tables"]["cover_letters"]["Insert"];

export type { CoverLetterRow, CoverLetterInsert };

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
