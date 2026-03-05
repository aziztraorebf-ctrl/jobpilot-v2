"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/settings/profile-form";
import { SearchPreferences } from "@/components/settings/search-preferences";
import { CVUpload } from "@/components/settings/cv-upload";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import type { ResumeRow } from "@/lib/supabase/queries";

/**
 * Typed shape of the JSONB search_preferences column.
 * Shared across all settings form components.
 */
export interface SearchPreferencesData {
  keywords?: string[];
  locations?: string[];
  salary_min?: number;
  salary_currency?: string;
  remote_preference?: "remote" | "hybrid" | "any";
  notification_frequency?: "manual" | "daily" | "weekly";
  notification_hour?: number;
  alert_threshold?: number;
  alert_new_jobs?: boolean;
  alert_follow_up?: boolean;
  alert_weekly_summary?: boolean;
  rotation_profiles?: Array<{
    resume_id: string | null;
    keywords: string[];
    label: string;
  }>;
  active_profile_index?: number;
  rotation_enabled?: boolean;
  rotation_days?: 1 | 2 | 3;
  last_rotation_at?: string | null;
}

export interface ProfileData {
  full_name: string;
  email: string;
  preferred_language: "fr" | "en";
}

interface SettingsPageClientProps {
  profile: ProfileData;
  searchPreferences: SearchPreferencesData;
  resumes: ResumeRow[];
  title: string;
}

export function SettingsPageClient({
  profile,
  searchPreferences,
  resumes,
  title,
}: SettingsPageClientProps) {
  const t = useTranslations("settings");

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Tabs defaultValue="profile">
        <TabsList className="w-full flex">
          <TabsTrigger value="profile" className="flex-1 text-xs sm:text-sm px-1 sm:px-2">
            {t("profile")}
          </TabsTrigger>
          <TabsTrigger value="search" className="flex-1 text-xs sm:text-sm px-1 sm:px-2">
            <span className="sm:hidden">{t("searchPreferencesShort")}</span>
            <span className="hidden sm:inline">{t("searchPreferences")}</span>
          </TabsTrigger>
          <TabsTrigger value="cv" className="flex-1 text-xs sm:text-sm px-1 sm:px-2">
            <span className="sm:hidden">{t("cvResumeShort")}</span>
            <span className="hidden sm:inline">{t("cvResume")}</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex-1 text-xs sm:text-sm px-1 sm:px-2">
            {t("appearance")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 text-xs sm:text-sm px-1 sm:px-2">
            {t("notifications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileForm profile={profile} />
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <SearchPreferences searchPreferences={searchPreferences} />
        </TabsContent>

        <TabsContent value="cv" className="mt-6">
          <CVUpload resumes={resumes} />
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationSettings searchPreferences={searchPreferences} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
