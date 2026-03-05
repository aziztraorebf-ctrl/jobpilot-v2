interface ActiveSearchProfile {
  keywords: string[];
  resumeId: string | null;
  label: string;
  profileIndex: number;
}

export function getActiveSearchProfile(
  prefs: Record<string, unknown>
): ActiveSearchProfile {
  const profiles = prefs.rotation_profiles as Array<{
    resume_id: string | null;
    keywords: string[];
    label: string;
  }> | undefined;

  // New format: rotation_profiles array
  if (profiles && profiles.length > 0) {
    const rotationEnabled = prefs.rotation_enabled === true;
    const index = rotationEnabled
      ? (typeof prefs.active_profile_index === "number" ? prefs.active_profile_index : 0)
      : 0;
    const safeIndex = Math.min(index, profiles.length - 1);
    const profile = profiles[safeIndex];
    if (!profile) {
      return { keywords: [], resumeId: null, label: "Principal", profileIndex: 0 };
    }
    return {
      keywords: profile.keywords ?? [],
      resumeId: profile.resume_id ?? null,
      label: profile.label ?? "Principal",
      profileIndex: safeIndex,
    };
  }

  // Legacy format: flat keywords array
  const keywords = (prefs.keywords as string[] | undefined) ?? [];
  return {
    keywords,
    resumeId: null,
    label: "Principal",
    profileIndex: 0,
  };
}

export function shouldRotate(prefs: Record<string, unknown>): boolean {
  if (prefs.rotation_enabled !== true) return false;

  const profiles = prefs.rotation_profiles as unknown[] | undefined;
  if (!profiles || profiles.length < 2) return false;

  const rotationDays = typeof prefs.rotation_days === "number" ? prefs.rotation_days : 2;
  const lastRotationAt = prefs.last_rotation_at as string | null | undefined;

  if (!lastRotationAt) return true;

  const lastRotation = new Date(lastRotationAt).getTime();
  if (isNaN(lastRotation)) return true;

  const now = Date.now();
  const daysSince = (now - lastRotation) / (1000 * 60 * 60 * 24);

  return daysSince >= rotationDays;
}

export function getNextRotationIndex(
  currentIndex: number,
  profileCount: number
): number {
  return (currentIndex + 1) % profileCount;
}

export function migrateToProfiles(
  prefs: Record<string, unknown>
): Record<string, unknown> {
  // Already migrated
  if (Array.isArray(prefs.rotation_profiles)) return prefs;

  // Migrate from flat keywords
  const keywords = (prefs.keywords as string[] | undefined) ?? [];
  const { keywords: _removed, ...rest } = prefs;
  void _removed;

  return {
    ...rest,
    rotation_profiles: [
      {
        resume_id: null,
        keywords: keywords.length > 0 ? keywords : [],
        label: "Principal",
      },
    ],
    active_profile_index: 0,
    rotation_enabled: false,
    rotation_days: 2,
    last_rotation_at: null,
  };
}
