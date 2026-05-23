import { describe, it, expect } from "vitest";
import { deduplicateJobs, isListingPage } from "../deduplicator";
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

describe("isListingPage", () => {
  it("rejects Jobillico listing root", () => {
    expect(isListingPage("https://www.jobillico.com/recherche-emploi/")).toBe(true);
  });

  it("rejects Jobillico category+city listing", () => {
    expect(isListingPage("https://www.jobillico.com/recherche-emploi/commis-d-entrepot/quebec/")).toBe(true);
  });

  it("rejects Jobboom listing root", () => {
    expect(isListingPage("https://www.jobboom.com/emplois/")).toBe(true);
  });

  it("rejects generic /search page", () => {
    expect(isListingPage("https://example.com/search")).toBe(true);
  });

  it("rejects /search with query string", () => {
    expect(isListingPage("https://example.com/search?q=developer")).toBe(true);
  });

  it("rejects /job-search page", () => {
    expect(isListingPage("https://example.com/job-search/")).toBe(true);
  });

  it("keeps Jobillico individual offer URL", () => {
    expect(isListingPage("https://www.jobillico.com/emploi/12345-commis-entrepot-xyz")).toBe(false);
  });

  it("keeps URL with /search/ in a sub-path (offer with ID)", () => {
    expect(isListingPage("https://emploi.example.com/search/job/12345")).toBe(false);
  });

  it("keeps Adzuna offer URL", () => {
    expect(isListingPage("https://www.adzuna.ca/details/5678901234")).toBe(false);
  });

  it("keeps JSearch offer URL", () => {
    expect(isListingPage("https://ca.indeed.com/viewjob?jk=abcd1234")).toBe(false);
  });

  it("keeps Jobboom individual offer", () => {
    expect(isListingPage("https://www.jobboom.com/emploi/developpeur-fullstack-12345")).toBe(false);
  });

  it("returns false for invalid URL", () => {
    expect(isListingPage("not-a-url")).toBe(false);
  });
});

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

  it("filters out listing page URLs before deduplication", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", title: "Real offer", source_url: "https://www.jobillico.com/emploi/12345-dev" }),
      makeJob({ dedup_hash: "bbb", title: "Listing page", source_url: "https://www.jobillico.com/recherche-emploi/" }),
      makeJob({ dedup_hash: "ccc", title: "Another listing", source_url: "https://www.jobboom.com/emplois/" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Real offer");
  });
});
