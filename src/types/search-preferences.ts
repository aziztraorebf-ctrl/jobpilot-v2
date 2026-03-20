/**
 * Shape of the search_preferences JSON column on the profiles table.
 * Supports both legacy flat format and the newer rotation_profiles format.
 */
export interface SearchPreferences {
  keywords: string[];
  locations: string[];
  sources: ("jsearch" | "adzuna")[];
  remote_only: boolean;
  alert_threshold: number;
  notification_frequency: "manual" | "daily" | "weekly";
  rotation_profiles?: {
    resume_id: string | null;
    keywords: string[];
    label: string;
  }[];
  active_profile_index?: number;
  rotation_enabled?: boolean;
  rotation_days?: number;
  last_rotation_at?: string | null;
  keyword_rotation_index?: number;
  inbox_limit?: number;
}

const DEFAULTS: SearchPreferences = {
  keywords: [],
  locations: ["Canada"],
  sources: ["jsearch", "adzuna"],
  remote_only: false,
  alert_threshold: 60,
  notification_frequency: "manual",
};

/**
 * Safely parse a raw JSON value (from Supabase) into SearchPreferences,
 * filling missing fields with sensible defaults.
 */
export function parseSearchPreferences(
  raw: unknown
): SearchPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };

  const obj = raw as Record<string, unknown>;

  return {
    keywords: Array.isArray(obj.keywords)
      ? (obj.keywords as string[])
      : DEFAULTS.keywords,
    locations: Array.isArray(obj.locations)
      ? (obj.locations as string[])
      : DEFAULTS.locations,
    sources: Array.isArray(obj.sources)
      ? (obj.sources as SearchPreferences["sources"])
      : DEFAULTS.sources,
    remote_only:
      typeof obj.remote_only === "boolean"
        ? obj.remote_only
        : DEFAULTS.remote_only,
    alert_threshold:
      typeof obj.alert_threshold === "number"
        ? obj.alert_threshold
        : DEFAULTS.alert_threshold,
    notification_frequency:
      obj.notification_frequency === "daily" ||
      obj.notification_frequency === "weekly" ||
      obj.notification_frequency === "manual"
        ? obj.notification_frequency
        : DEFAULTS.notification_frequency,
    rotation_profiles: Array.isArray(obj.rotation_profiles)
      ? (obj.rotation_profiles as SearchPreferences["rotation_profiles"])
      : undefined,
    active_profile_index:
      typeof obj.active_profile_index === "number"
        ? obj.active_profile_index
        : undefined,
    rotation_enabled:
      typeof obj.rotation_enabled === "boolean"
        ? obj.rotation_enabled
        : undefined,
    rotation_days:
      typeof obj.rotation_days === "number"
        ? obj.rotation_days
        : undefined,
    last_rotation_at:
      typeof obj.last_rotation_at === "string"
        ? obj.last_rotation_at
        : undefined,
    keyword_rotation_index:
      typeof obj.keyword_rotation_index === "number"
        ? obj.keyword_rotation_index
        : undefined,
    inbox_limit:
      typeof obj.inbox_limit === "number" ? obj.inbox_limit : undefined,
  };
}
