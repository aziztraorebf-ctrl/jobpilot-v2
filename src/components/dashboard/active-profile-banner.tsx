"use client";

import { getActiveSearchProfile } from "@/lib/utils/search-profile-helpers";

interface RotationProfile {
  label: string;
}

interface ActiveProfileBannerProps {
  searchPreferences: Record<string, unknown> | null;
}

export function ActiveProfileBanner({ searchPreferences }: ActiveProfileBannerProps) {
  if (!searchPreferences) return null;

  const profiles = searchPreferences.rotation_profiles as RotationProfile[] | undefined;

  // Only show when 2 profiles are configured
  if (!profiles || profiles.length < 2) return null;

  const rotationEnabled = searchPreferences.rotation_enabled === true;
  const active = getActiveSearchProfile(searchPreferences);
  const rotationDays = typeof searchPreferences.rotation_days === "number" ? searchPreferences.rotation_days : 2;
  const lastRotationAt = searchPreferences.last_rotation_at as string | null;

  let daysUntilRotation: number | null = null;
  if (rotationEnabled && lastRotationAt) {
    const elapsed = (Date.now() - new Date(lastRotationAt).getTime()) / (1000 * 60 * 60 * 24);
    daysUntilRotation = Math.max(0, Math.ceil(rotationDays - elapsed));
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      <span className="text-blue-800 dark:text-blue-200">
        <span className="font-medium">Profil actif : {active.label}</span>
        {rotationEnabled && daysUntilRotation !== null && (
          <span className="ml-2 text-blue-600 dark:text-blue-400">
            {daysUntilRotation === 0
              ? "— rotation aujourd'hui"
              : `— rotation dans ${daysUntilRotation} jour${daysUntilRotation > 1 ? "s" : ""}`}
          </span>
        )}
        {!rotationEnabled && (
          <span className="ml-2 text-blue-600 dark:text-blue-400">— rotation désactivée</span>
        )}
      </span>
    </div>
  );
}
