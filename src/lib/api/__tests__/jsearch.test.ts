import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchJSearch, type JSearchParams } from "../jsearch";
import { resetEnv } from "@/lib/env";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function stubAllEnv(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    OPENAI_API_KEY: "sk-test-openai-key",
    JSEARCH_API_KEY: "test-api-key",
    ADZUNA_APP_ID: "test-adzuna-id",
    ADZUNA_APP_KEY: "test-adzuna-key",
    ADZUNA_COUNTRY: "ca",
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    vi.stubEnv(key, value);
  }
}

describe("searchJSearch", () => {
  beforeEach(() => {
    resetEnv();
    stubAllEnv();
    mockFetch.mockReset();
  });

  it("calls JSearch API with correct URL and headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "OK", request_id: "abc", data: [] }),
    });

    await searchJSearch({ query: "developer in Montreal" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledUrl).toContain("api.openwebninja.com/jsearch/search");
    expect(calledUrl).toContain("query=developer+in+Montreal");
    expect(calledUrl).toContain("country=ca");
    expect((calledOptions.headers as Record<string, string>)["x-api-key"]).toBe("test-api-key");
  });

  it("returns normalized UnifiedJob array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        request_id: "abc",
        data: [
          {
            job_id: "abc123==",
            job_title: "Senior Developer",
            employer_name: "TechCorp",
            employer_logo: null,
            employer_website: "https://techcorp.com",
            job_publisher: "LinkedIn",
            job_employment_type: "Full-time",
            job_employment_types: ["FULLTIME"],
            job_apply_link: "https://linkedin.com/jobs/123",
            job_apply_is_direct: false,
            job_description: "Great job building things",
            job_is_remote: false,
            job_posted_at: "2 days ago",
            job_posted_at_timestamp: 1706745600,
            job_posted_at_datetime_utc: "2026-01-31T00:00:00.000Z",
            job_city: "Montreal",
            job_state: "QC",
            job_country: "CA",
            job_latitude: 45.5017,
            job_longitude: -73.5673,
            job_min_salary: 90000,
            job_max_salary: 120000,
            job_salary_currency: "CAD",
            job_salary_period: "YEAR",
          },
        ],
      }),
    });

    const result = await searchJSearch({ query: "developer in Montreal" });
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.source).toBe("jsearch");
    expect(job.source_id).toBe("abc123==");
    expect(job.title).toBe("Senior Developer");
    expect(job.company_name).toBe("TechCorp");
    expect(job.location).toBe("Montreal, QC, CA");
    expect(job.location_lat).toBe(45.5017);
    expect(job.location_lng).toBe(-73.5673);
    expect(job.salary_min).toBe(90000);
    expect(job.salary_max).toBe(120000);
    expect(job.salary_currency).toBe("CAD");
    expect(job.job_type).toBe("Full-time");
    expect(job.remote_type).toBe("unknown");
    expect(job.source_url).toBe("https://linkedin.com/jobs/123");
    expect(job.dedup_hash).toHaveLength(16);
  });

  it("handles remote jobs correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        request_id: "abc",
        data: [
          {
            job_id: "remote1==",
            job_title: "Backend Engineer",
            job_apply_link: "https://example.com/apply",
            job_is_remote: true,
          },
        ],
      }),
    });

    const result = await searchJSearch({ query: "remote backend" });
    expect(result.jobs[0].remote_type).toBe("remote");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });
    await expect(searchJSearch({ query: "test" })).rejects.toThrow(
      "JSearch API error: 429 Too Many Requests"
    );
  });

  it("throws when JSEARCH_API_KEY is not set", async () => {
    resetEnv();
    vi.stubEnv("JSEARCH_API_KEY", "");
    await expect(searchJSearch({ query: "test" })).rejects.toThrow(
      "Missing or invalid environment variables"
    );
  });

  it("skips jobs that fail Zod validation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        request_id: "abc",
        data: [
          {
            job_id: "valid1==",
            job_title: "Valid Job",
            job_apply_link: "https://example.com/valid",
          },
          {
            // Missing required job_title - should fail
            job_id: "invalid1==",
            job_apply_link: "https://example.com/invalid",
          },
        ],
      }),
    });

    const result = await searchJSearch({ query: "test" });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Valid Job");
  });

  it("passes optional filters to URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "OK", request_id: "abc", data: [] }),
    });

    await searchJSearch({
      query: "developer",
      page: 2,
      numPages: 3,
      datePosted: "week",
      remoteOnly: true,
      employmentTypes: "FULLTIME,CONTRACTOR",
      radius: 50,
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("num_pages=3");
    expect(calledUrl).toContain("date_posted=week");
    expect(calledUrl).toContain("work_from_home=true");
    expect(calledUrl).toContain("employment_types=FULLTIME%2CCONTRACTOR");
    expect(calledUrl).toContain("radius=50");
  });
});
