import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProfilesWithAutoSearch } from "../profiles";
import { createChainBuilder, useMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";
const mockGetSupabase = vi.mocked(getSupabase);

function withFrom(chain: Record<string, unknown>): Record<string, unknown> {
  chain.from = vi.fn().mockReturnValue(chain);
  return chain;
}

const MOCK_PROFILE_DAILY = {
  id: "user-1",
  full_name: "Test User",
  email: "test@test.com",
  preferred_language: "fr",
  search_preferences: { notification_frequency: "daily", keywords: ["dev"] },
  openai_tokens_used: 0,
  openai_tokens_limit: 50000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("getProfilesWithAutoSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches profiles with daily or weekly notification frequency", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: [MOCK_PROFILE_DAILY],
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    const result = await getProfilesWithAutoSearch();

    expect(result).toEqual([MOCK_PROFILE_DAILY]);
    expect(mockClient.from).toHaveBeenCalledWith("profiles");
    expect(mockClient.select).toHaveBeenCalledWith("*");
    expect(mockClient.or).toHaveBeenCalled();
  });

  it("returns empty array when no profiles have auto-search", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: [],
      error: null,
    }));
    useMock(mockGetSupabase, mockClient);

    const result = await getProfilesWithAutoSearch();
    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    const mockClient = withFrom(createChainBuilder({
      data: null,
      error: { message: "Query failed" },
    }));
    useMock(mockGetSupabase, mockClient);

    await expect(getProfilesWithAutoSearch()).rejects.toThrow(
      "Failed to fetch auto-search profiles: Query failed"
    );
  });
});
