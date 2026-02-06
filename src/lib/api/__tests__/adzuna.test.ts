import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchAdzuna, type AdzunaSearchParams } from "../adzuna";
import { resetEnv } from "@/lib/env";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function stubAllEnv(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    OPENAI_API_KEY: "sk-test-openai-key",
    JSEARCH_API_KEY: "test-jsearch-key",
    ADZUNA_APP_ID: "test-id",
    ADZUNA_APP_KEY: "test-key",
    ADZUNA_COUNTRY: "ca",
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    vi.stubEnv(key, value);
  }
}

describe("searchAdzuna", () => {
  beforeEach(() => {
    resetEnv();
    stubAllEnv();
    mockFetch.mockReset();
  });

  it("calls Adzuna API with correct URL params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });

    await searchAdzuna({ keywords: "developer", location: "Montreal" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.adzuna.com");
    expect(calledUrl).toContain("app_id=test-id");
    expect(calledUrl).toContain("app_key=test-key");
    expect(calledUrl).toContain("what=developer");
    expect(calledUrl).toContain("where=Montreal");
  });

  it("returns normalized UnifiedJob array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        count: 1,
        results: [
          {
            id: "789",
            title: "Dev",
            company: { display_name: "Shopify" },
            location: { display_name: "Ottawa" },
            salary_min: 80000,
            salary_max: 100000,
            description: "Nice job",
            redirect_url: "https://adzuna.ca/j/789",
            created: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });

    const result = await searchAdzuna({ keywords: "dev" });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].source).toBe("adzuna");
    expect(result.jobs[0].salary_min).toBe(80000);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });
    await expect(searchAdzuna({ keywords: "test" })).rejects.toThrow(
      "Adzuna API error: 429 Too Many Requests"
    );
  });

  it("handles pagination with custom page number", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 50, results: [] }),
    });

    await searchAdzuna({ keywords: "analyst", page: 3 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/search/3");
  });

  it("throws when ADZUNA_APP_ID is not set", async () => {
    resetEnv();
    stubAllEnv({ ADZUNA_APP_ID: "" });
    await expect(searchAdzuna({ keywords: "test" })).rejects.toThrow(
      "Missing or invalid environment variables"
    );
  });

  it("throws when ADZUNA_APP_KEY is not set", async () => {
    resetEnv();
    stubAllEnv({ ADZUNA_APP_KEY: "" });
    await expect(searchAdzuna({ keywords: "test" })).rejects.toThrow(
      "Missing or invalid environment variables"
    );
  });

  it("skips jobs that fail Zod validation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        count: 2,
        results: [
          {
            id: "1",
            title: "Valid Job",
            company: { display_name: "Corp" },
            location: { display_name: "Montreal" },
            description: "A job",
            redirect_url: "https://adzuna.ca/j/1",
          },
          {
            // Missing required title - should fail validation
            id: "2",
            company: { display_name: "Corp" },
            redirect_url: "https://adzuna.ca/j/2",
          },
        ],
      }),
    });

    const result = await searchAdzuna({ keywords: "test" });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Valid Job");
    expect(result.total).toBe(2);
  });

  it("defaults country to ca when ADZUNA_COUNTRY is not set", async () => {
    // The Zod schema has .default("ca"), so when ADZUNA_COUNTRY is undefined
    // the default value "ca" will be used
    resetEnv();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai-key");
    vi.stubEnv("JSEARCH_API_KEY", "test-jsearch-key");
    vi.stubEnv("ADZUNA_APP_ID", "test-id");
    vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    // ADZUNA_COUNTRY intentionally NOT set

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });

    await searchAdzuna({ keywords: "dev" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/jobs/ca/search/");
  });
});
