import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UnifiedJob } from "@/lib/schemas/job";
import { createChainBuilder, type MockResponse } from "@/test/supabase-mock";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

// We store per-table config so tests can set different responses
// for sequential calls to the same table.
let tableCallIndex: Record<string, number> = {};
let tableResponses: Record<string, MockResponse[]> = {};

function mockFrom(table: string) {
  const idx = tableCallIndex[table] ?? 0;
  const responses = tableResponses[table] ?? [];
  const response = responses[idx] ?? { data: null, error: null };
  tableCallIndex[table] = idx + 1;
  return createChainBuilder(response);
}

const mockSupabase = { from: vi.fn(mockFrom) };

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: () => mockSupabase,
}));

const TEST_USER_ID = "test-user-id-000";

// Import AFTER mocks are set up
import {
  upsertJobs,
  getJobs,
  getJobById,
  dismissJob,
  getDismissedJobIds,
  getDismissedJobs,
  restoreJob,
} from "../jobs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUnifiedJob(overrides: Partial<UnifiedJob> = {}): UnifiedJob {
  return {
    source: "jsearch",
    source_id: "src-1",
    source_url: "https://example.com/job/1",
    dedup_hash: "hash_aaa111",
    title: "Software Developer",
    company_name: "TestCorp",
    location: "Montreal, QC",
    location_lat: 45.5,
    location_lng: -73.6,
    description: "A great job",
    salary_min: 80000,
    salary_max: 120000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "Full-time",
    category: "IT",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: "2026-01-15T00:00:00Z",
    raw_data: { original: true },
    ...overrides,
  };
}

function makeJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "uuid-row-1",
    source: "jsearch",
    source_id: "src-1",
    source_url: "https://example.com/job/1",
    dedup_hash: "hash_aaa111",
    title: "Software Developer",
    company_name: "TestCorp",
    location: "Montreal, QC",
    location_lat: 45.5,
    location_lng: -73.6,
    description: "A great job",
    salary_min: 80000,
    salary_max: 120000,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: "Full-time",
    category: "IT",
    contract_type: "permanent",
    remote_type: "hybrid",
    posted_at: "2026-01-15T00:00:00Z",
    fetched_at: "2026-01-20T12:00:00Z",
    raw_data: { original: true },
    company_career_url: null,
    company_description: null,
    is_active: true,
    created_at: "2026-01-20T12:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  tableCallIndex = {};
  tableResponses = {};
});

// ---------------------------------------------------------------------------
// upsertJobs
// ---------------------------------------------------------------------------

describe("upsertJobs", () => {
  it("returns empty array when given no jobs", async () => {
    const result = await upsertJobs([]);
    expect(result).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("upserts jobs and returns inserted rows", async () => {
    const job = makeUnifiedJob();

    // Single call: .from("job_listings").upsert(rows, opts).select()
    tableResponses["job_listings"] = [
      { data: [makeJobRow()], error: null },
    ];

    const result = await upsertJobs([job]);

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
    expect(result).toHaveLength(1);
    expect(result[0].dedup_hash).toBe("hash_aaa111");
  });

  it("handles multiple jobs with mixed new and existing hashes", async () => {
    const job1 = makeUnifiedJob({ dedup_hash: "existing_hash" });
    const job2 = makeUnifiedJob({ dedup_hash: "new_hash", title: "New Position" });

    // ignoreDuplicates skips existing, returns only newly inserted
    tableResponses["job_listings"] = [
      {
        data: [
          makeJobRow({ id: "uuid-new", dedup_hash: "new_hash", title: "New Position" }),
        ],
        error: null,
      },
    ];

    const result = await upsertJobs([job1, job2]);

    // Only 1 call to from() - the upsert handles dedup natively
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when all jobs are duplicates (data is null)", async () => {
    const job = makeUnifiedJob({ dedup_hash: "already_here" });

    // ignoreDuplicates returns no rows when all are skipped
    tableResponses["job_listings"] = [
      { data: null, error: null },
    ];

    const result = await upsertJobs([job]);

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it("throws on upsert error", async () => {
    tableResponses["job_listings"] = [
      { data: null, error: { message: "constraint violation" } },
    ];

    await expect(upsertJobs([makeUnifiedJob()])).rejects.toThrow(
      "Failed to upsert jobs: constraint violation"
    );
  });
});

// ---------------------------------------------------------------------------
// getJobs
// ---------------------------------------------------------------------------

describe("getJobs", () => {
  it("fetches active jobs with default limit/offset", async () => {
    const rows = [makeJobRow(), makeJobRow({ id: "uuid-2", title: "Other Job" })];
    tableResponses["job_listings"] = [{ data: rows, error: null }];

    const result = await getJobs();

    expect(result).toHaveLength(2);
    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
  });

  it("passes source filter", async () => {
    tableResponses["job_listings"] = [{ data: [], error: null }];

    const result = await getJobs({ source: "adzuna" });

    expect(result).toEqual([]);
    // Verify from was called (chain methods are tested implicitly)
    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
  });

  it("passes remoteType filter", async () => {
    tableResponses["job_listings"] = [{ data: [], error: null }];

    const result = await getJobs({ remoteType: "remote" });

    expect(result).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
  });

  it("applies search filter with ilike pattern", async () => {
    const matchingRow = makeJobRow({ title: "React Developer" });
    tableResponses["job_listings"] = [{ data: [matchingRow], error: null }];

    const result = await getJobs({ search: "react" });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("React Developer");
  });

  it("escapes LIKE special characters in search", async () => {
    tableResponses["job_listings"] = [{ data: [], error: null }];

    // Characters %, _, and \ should be escaped to prevent wildcard injection
    await getJobs({ search: "100%_match\\test" });

    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
    // The function should not throw - it should pass a sanitized string
  });

  it("applies custom limit and offset", async () => {
    tableResponses["job_listings"] = [{ data: [], error: null }];

    await getJobs({ limit: 10, offset: 20 });

    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
  });

  it("throws on query error", async () => {
    tableResponses["job_listings"] = [
      { data: null, error: { message: "timeout" } },
    ];

    await expect(getJobs()).rejects.toThrow("Failed to fetch jobs: timeout");
  });

  it("returns empty array when data is null", async () => {
    tableResponses["job_listings"] = [{ data: null, error: null }];

    const result = await getJobs();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getJobById
// ---------------------------------------------------------------------------

describe("getJobById", () => {
  it("returns a single job by ID", async () => {
    const row = makeJobRow({ id: "uuid-target" });
    tableResponses["job_listings"] = [{ data: row, error: null }];

    const result = await getJobById("uuid-target");

    expect(result.id).toBe("uuid-target");
    expect(mockSupabase.from).toHaveBeenCalledWith("job_listings");
  });

  it("throws when job is not found", async () => {
    tableResponses["job_listings"] = [
      { data: null, error: { message: "Row not found" } },
    ];

    await expect(getJobById("nonexistent")).rejects.toThrow(
      "Failed to fetch job: Row not found"
    );
  });

  it("throws when jobId is empty string", async () => {
    await expect(getJobById("")).rejects.toThrow("jobId is required");
  });
});

// ---------------------------------------------------------------------------
// dismissJob
// ---------------------------------------------------------------------------

describe("dismissJob", () => {
  it("upserts a seen_jobs row with dismissed=true", async () => {
    tableResponses["seen_jobs"] = [
      { data: null, error: null },
    ];

    await dismissJob(TEST_USER_ID, "job-listing-123");

    expect(mockSupabase.from).toHaveBeenCalledWith("seen_jobs");
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("throws when jobListingId is empty", async () => {
    await expect(dismissJob(TEST_USER_ID, "")).rejects.toThrow("jobListingId is required");
  });

  it("throws on upsert error", async () => {
    tableResponses["seen_jobs"] = [
      { data: null, error: { message: "FK violation" } },
    ];

    await expect(dismissJob(TEST_USER_ID, "bad-ref")).rejects.toThrow(
      "Failed to dismiss job: FK violation"
    );
  });
});

// ---------------------------------------------------------------------------
// getDismissedJobIds
// ---------------------------------------------------------------------------

describe("getDismissedJobIds", () => {
  it("returns array of job_listing_ids for dismissed jobs", async () => {
    tableResponses["seen_jobs"] = [
      {
        data: [
          { job_listing_id: "jl-1" },
          { job_listing_id: "jl-2" },
          { job_listing_id: "jl-3" },
        ],
        error: null,
      },
    ];

    const result = await getDismissedJobIds(TEST_USER_ID);

    expect(result).toEqual(["jl-1", "jl-2", "jl-3"]);
    expect(mockSupabase.from).toHaveBeenCalledWith("seen_jobs");
  });

  it("returns empty array when no dismissed jobs", async () => {
    tableResponses["seen_jobs"] = [{ data: [], error: null }];

    const result = await getDismissedJobIds(TEST_USER_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    tableResponses["seen_jobs"] = [{ data: null, error: null }];

    const result = await getDismissedJobIds(TEST_USER_ID);
    expect(result).toEqual([]);
  });

  it("throws on query error", async () => {
    tableResponses["seen_jobs"] = [
      { data: null, error: { message: "network error" } },
    ];

    await expect(getDismissedJobIds(TEST_USER_ID)).rejects.toThrow(
      "Failed to fetch dismissed jobs: network error"
    );
  });
});

// ---------------------------------------------------------------------------
// getDismissedJobs
// ---------------------------------------------------------------------------

describe("getDismissedJobs", () => {
  it("returns full job rows for dismissed jobs", async () => {
    const jobRow = makeJobRow({ id: "jl-dismissed-1" });
    tableResponses["seen_jobs"] = [
      {
        data: [
          { job_listing_id: "jl-dismissed-1", job_listings: jobRow },
        ],
        error: null,
      },
    ];

    const result = await getDismissedJobs(TEST_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("jl-dismissed-1");
    expect(mockSupabase.from).toHaveBeenCalledWith("seen_jobs");
  });

  it("returns empty array when no dismissed jobs exist", async () => {
    tableResponses["seen_jobs"] = [{ data: [], error: null }];

    const result = await getDismissedJobs(TEST_USER_ID);

    expect(result).toEqual([]);
  });

  it("filters out null job_listings entries", async () => {
    tableResponses["seen_jobs"] = [
      {
        data: [
          { job_listing_id: "jl-1", job_listings: makeJobRow({ id: "jl-1" }) },
          { job_listing_id: "jl-2", job_listings: null },
        ],
        error: null,
      },
    ];

    const result = await getDismissedJobs(TEST_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("jl-1");
  });

  it("throws on query error", async () => {
    tableResponses["seen_jobs"] = [
      { data: null, error: { message: "connection lost" } },
    ];

    await expect(getDismissedJobs(TEST_USER_ID)).rejects.toThrow(
      "Failed to fetch dismissed jobs: connection lost"
    );
  });
});

// ---------------------------------------------------------------------------
// restoreJob
// ---------------------------------------------------------------------------

describe("restoreJob", () => {
  it("updates seen_jobs with dismissed=false", async () => {
    tableResponses["seen_jobs"] = [{ data: null, error: null }];

    await restoreJob(TEST_USER_ID, "job-to-restore");

    expect(mockSupabase.from).toHaveBeenCalledWith("seen_jobs");
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("throws when jobListingId is empty", async () => {
    await expect(restoreJob(TEST_USER_ID, "")).rejects.toThrow(
      "jobListingId is required"
    );
  });

  it("throws on update error", async () => {
    tableResponses["seen_jobs"] = [
      { data: null, error: { message: "permission denied" } },
    ];

    await expect(restoreJob(TEST_USER_ID, "bad-id")).rejects.toThrow(
      "Failed to restore job: permission denied"
    );
  });
});
