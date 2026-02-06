import { getTranslations } from "next-intl/server";
import { getProfile, getResumes, type ResumeRow } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import {
  SettingsPageClient,
  type SearchPreferencesData,
} from "@/components/settings/settings-page-client";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const user = await requireUser();

  let profile;
  try {
    profile = await getProfile(user.id);
  } catch (error) {
    console.error("[SettingsPage] Failed to fetch profile:", error);
    // Provide safe defaults when profile fetch fails
    profile = {
      id: user.id,
      full_name: "",
      email: "",
      preferred_language: "fr" as const,
      search_preferences: null,
      openai_tokens_used: 0,
      openai_tokens_limit: 50000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Safely parse search_preferences from JSONB (could be any shape)
  const rawPrefs = profile.search_preferences;
  const searchPreferences: SearchPreferencesData =
    rawPrefs !== null && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)
      ? (rawPrefs as SearchPreferencesData)
      : {};

  // Fetch resumes for CV upload tab
  let resumes: ResumeRow[];
  try {
    resumes = await getResumes(user.id);
  } catch (error) {
    console.error("[SettingsPage] Failed to fetch resumes:", error);
    resumes = [];
  }

  return (
    <SettingsPageClient
      profile={{
        full_name: profile.full_name,
        email: profile.email,
        preferred_language: profile.preferred_language,
      }}
      searchPreferences={searchPreferences}
      resumes={resumes}
      title={t("title")}
    />
  );
}
