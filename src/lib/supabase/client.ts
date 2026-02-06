import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Single server-side client using service_role key
// No RLS, no auth - protected by password middleware at Next.js level
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key);
}
