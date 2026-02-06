import { describe, it, expect } from "vitest";
import { deduplicateJobs } from "../deduplicator";
import type { UnifiedJob } from "@/lib/schemas/job";

function makeJob(overrides: Partial<UnifiedJob>): UnifiedJob {
  return {
    source: "jooble",
    source_id: "1",
    source_url: "https://example.com/1",
    dedup_hash: "abc123",
    title: "Developer",
    company_name: "Acme",
    location: "Montreal",
    location_lat: null,
    location_lng: null,
    description: "A job",
    salary_min: null,
    salary_max: null,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: null,
    category: null,
    contract_type: null,
    remote_type: "unknown",
    posted_at: null,
    raw_data: {},
    ...overrides,
  };
}

describe("deduplicateJobs", () => {
  it("removes duplicates with same dedup_hash", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", source: "jooble", source_id: "1" }),
      makeJob({ dedup_hash: "aaa", source: "adzuna", source_id: "2" }),
      makeJob({ dedup_hash: "bbb", source: "jooble", source_id: "3" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(2);
  });

  it("prefers adzuna over jooble (more data)", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", source: "jooble", salary_min: null }),
      makeJob({ dedup_hash: "aaa", source: "adzuna", salary_min: 50000, location_lat: 45.5 }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("adzuna");
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateJobs([])).toEqual([]);
  });

  it("preserves order of first-seen unique jobs", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", title: "First" }),
      makeJob({ dedup_hash: "bbb", title: "Second" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result[0].title).toBe("First");
    expect(result[1].title).toBe("Second");
  });
});
