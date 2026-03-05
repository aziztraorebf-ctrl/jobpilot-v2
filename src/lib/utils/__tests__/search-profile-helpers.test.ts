import { describe, it, expect } from "vitest";
import {
  getActiveSearchProfile,
  getNextRotationIndex,
  shouldRotate,
  migrateToProfiles,
} from "../search-profile-helpers";

describe("getActiveSearchProfile", () => {
  it("returns keywords from old flat format", () => {
    const prefs = { keywords: ["Chef de projet", "Manager"] };
    const result = getActiveSearchProfile(prefs);
    expect(result.keywords).toEqual(["Chef de projet", "Manager"]);
    expect(result.resumeId).toBeNull();
    expect(result.label).toBe("Principal");
  });

  it("returns active profile from new format", () => {
    const prefs = {
      rotation_profiles: [
        { resume_id: "550e8400-e29b-41d4-a716-446655440001", keywords: ["Security Supervisor"], label: "Sécurité" },
        { resume_id: "550e8400-e29b-41d4-a716-446655440002", keywords: ["Chef de projet"], label: "Coordination" },
      ],
      active_profile_index: 1,
      rotation_enabled: true,
    };
    const result = getActiveSearchProfile(prefs);
    expect(result.keywords).toEqual(["Chef de projet"]);
    expect(result.resumeId).toBe("550e8400-e29b-41d4-a716-446655440002");
    expect(result.label).toBe("Coordination");
  });

  it("returns profile 0 when rotation_enabled is false", () => {
    const prefs = {
      rotation_profiles: [
        { resume_id: "550e8400-e29b-41d4-a716-446655440001", keywords: ["Security Supervisor"], label: "Sécurité" },
        { resume_id: "550e8400-e29b-41d4-a716-446655440002", keywords: ["Chef de projet"], label: "Coordination" },
      ],
      active_profile_index: 1,
      rotation_enabled: false,
    };
    const result = getActiveSearchProfile(prefs);
    expect(result.keywords).toEqual(["Security Supervisor"]);
    expect(result.resumeId).toBe("550e8400-e29b-41d4-a716-446655440001");
  });

  it("returns empty keywords when prefs is empty", () => {
    const result = getActiveSearchProfile({});
    expect(result.keywords).toEqual([]);
    expect(result.resumeId).toBeNull();
  });
});

describe("shouldRotate", () => {
  it("returns true when enough days have passed", () => {
    const prefs = {
      rotation_profiles: [{}, {}],
      rotation_enabled: true,
      rotation_days: 2,
      last_rotation_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      active_profile_index: 0,
    };
    expect(shouldRotate(prefs as Record<string, unknown>)).toBe(true);
  });

  it("returns false when rotation is disabled", () => {
    const prefs = {
      rotation_profiles: [{}, {}],
      rotation_enabled: false,
      rotation_days: 1,
      last_rotation_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    expect(shouldRotate(prefs as Record<string, unknown>)).toBe(false);
  });

  it("returns false when only one profile exists", () => {
    const prefs = {
      rotation_profiles: [{}],
      rotation_enabled: true,
      rotation_days: 1,
      last_rotation_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    expect(shouldRotate(prefs as Record<string, unknown>)).toBe(false);
  });
});

describe("migrateToProfiles", () => {
  it("converts flat keywords to profiles array", () => {
    const prefs = { keywords: ["Chef de projet", "Manager"], locations: ["Montréal"] };
    const result = migrateToProfiles(prefs);
    expect(result.rotation_profiles).toBeDefined();
    const profiles = result.rotation_profiles as Array<Record<string, unknown>>;
    expect(profiles).toHaveLength(1);
    expect(profiles[0].keywords).toEqual(["Chef de projet", "Manager"]);
    expect(profiles[0].label).toBe("Principal");
    expect(profiles[0].resume_id).toBeNull();
    expect(result.keywords).toBeUndefined();
  });

  it("does not migrate if rotation_profiles already exists", () => {
    const prefs = {
      rotation_profiles: [{ keywords: ["Security"], label: "Sécurité", resume_id: null }],
    };
    const result = migrateToProfiles(prefs);
    const profiles = result.rotation_profiles as Array<Record<string, unknown>>;
    expect(profiles).toHaveLength(1);
  });
});

describe("getNextRotationIndex", () => {
  it("returns 1 when current is 0 and count is 2", () => {
    expect(getNextRotationIndex(0, 2)).toBe(1);
  });

  it("wraps back to 0 when current is 1 and count is 2", () => {
    expect(getNextRotationIndex(1, 2)).toBe(0);
  });
});
