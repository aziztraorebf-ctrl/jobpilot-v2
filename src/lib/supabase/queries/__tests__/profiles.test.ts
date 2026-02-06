import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProfile, updateProfile } from "../profiles";
import { createChainBuilder, useMock } from "@/test/supabase-mock";

// Mock the Supabase client module
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

const mockGetSupabase = vi.mocked(getSupabase);

// Reusable mock profile fixture
const MOCK_PROFILE = {
  id: "126d2d02-c032-49b0-a2c8-8a7034b6512f",
  full_name: "Aziz Test",
  email: "aziz@test.com",
  preferred_language: "fr" as const,
  search_preferences: {},
  openai_tokens_used: 100,
  openai_tokens_limit: 50000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

function withFrom(chain: Record<string, unknown>): Record<string, unknown> {
  chain.from = vi.fn().mockReturnValue(chain);
  return chain;
}

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile data on success", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: MOCK_PROFILE,
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    const result = await getProfile(MOCK_PROFILE.id);

    expect(result).toEqual(MOCK_PROFILE);
    expect(mockClient.from).toHaveBeenCalledWith("profiles");
    expect(mockClient.select).toHaveBeenCalledWith("*");
    expect(mockClient.eq).toHaveBeenCalledWith("id", MOCK_PROFILE.id);
    expect(mockClient.single).toHaveBeenCalled();
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: null,
      error: { message: "Row not found" },
    }));
    useMock(mockGetSupabase, mockClient);

    await expect(getProfile("nonexistent-id")).rejects.toThrow(
      "Failed to fetch profile: Row not found"
    );
  });

  it("calls Supabase with the exact userId parameter", async () => {
    const customId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const mockClient = withFrom(createChainBuilder({
      data: { ...MOCK_PROFILE, id: customId },
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    await getProfile(customId);

    expect(mockClient.eq).toHaveBeenCalledWith("id", customId);
  });
});

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls update with correct params and returns updated profile", async () => {
    const updatedProfile = {
      ...MOCK_PROFILE,
      full_name: "Aziz Updated",
      updated_at: "2026-01-20T00:00:00Z",
    };
    const mockClient = withFrom(createChainBuilder({
      data: updatedProfile,
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    const updates = { full_name: "Aziz Updated" };
    const result = await updateProfile(MOCK_PROFILE.id, updates);

    expect(result).toEqual(updatedProfile);
    expect(mockClient.from).toHaveBeenCalledWith("profiles");
    expect(mockClient.update).toHaveBeenCalledWith(updates);
    expect(mockClient.eq).toHaveBeenCalledWith("id", MOCK_PROFILE.id);
    expect(mockClient.select).toHaveBeenCalled();
    expect(mockClient.single).toHaveBeenCalled();
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: null,
      error: { message: "Update failed: constraint violation" },
    }));
    useMock(mockGetSupabase, mockClient);

    await expect(
      updateProfile(MOCK_PROFILE.id, { full_name: "Bad" })
    ).rejects.toThrow("Failed to update profile: Update failed: constraint violation");
  });

  it("passes partial updates correctly", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: { ...MOCK_PROFILE, preferred_language: "en" },
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    const updates = { preferred_language: "en" as const };
    await updateProfile(MOCK_PROFILE.id, updates);

    expect(mockClient.update).toHaveBeenCalledWith({ preferred_language: "en" });
  });

  it("handles empty updates object", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: MOCK_PROFILE,
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    const result = await updateProfile(MOCK_PROFILE.id, {});

    expect(result).toEqual(MOCK_PROFILE);
    expect(mockClient.update).toHaveBeenCalledWith({});
  });
});
