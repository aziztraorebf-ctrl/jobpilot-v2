import { describe, it, expect, vi } from "vitest";
import { aggregateJobSearch, type AggregateSearchParams } from "../job-aggregator";

vi.mock("@/lib/api/jsearch", () => ({
  searchJSearch: vi.fn().mockResolvedValue({
    jobs: [
      {
        source: "jsearch", source_id: "js1", source_url: "https://linkedin.com/jobs/1",
        dedup_hash: "hash_a", title: "Analyst", company_name: "CompanyA",
        location: "Montreal, QC, CA", location_lat: 45.5, location_lng: -73.5,
        description: "Job A from JSearch", salary_min: null, salary_max: null,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: "Full-time", category: null, contract_type: null,
        remote_type: "unknown", posted_at: null, raw_data: {},
      },
    ],
    total: 1,
  }),
}));

vi.mock("@/lib/api/tavily-jobs", () => ({
  searchTavily: vi.fn().mockResolvedValue({
    jobs: [
      {
        source: "tavily", source_id: null, source_url: "https://jobillico.com/offer/1",
        dedup_hash: "hash_c", title: "Superviseur", company_name: "GardaWorld",
        location: "Montreal", location_lat: null, location_lng: null,
        description: "Superviseur securite", salary_min: null, salary_max: null,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: null, category: null, contract_type: null,
        remote_type: "unknown", posted_at: null, raw_data: {},
      },
    ],
    total: 1,
  }),
}));

vi.mock("@/lib/api/tavily", () => ({
  isTavilyAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/api/adzuna", () => ({
  searchAdzuna: vi.fn().mockResolvedValue({
    jobs: [
      {
        source: "adzuna", source_id: "a1", source_url: "https://adzuna.ca/j/1",
        dedup_hash: "hash_a", title: "Analyst", company_name: "CompanyA",
        location: "Montreal", location_lat: 45.5, location_lng: -73.5,
        description: "Job A from Adzuna", salary_min: 60000, salary_max: 75000,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: "full_time", category: "IT Jobs", contract_type: "permanent",
        remote_type: "unknown", posted_at: "2026-01-15", raw_data: {},
      },
      {
        source: "adzuna", source_id: "a2", source_url: "https://adzuna.ca/j/2",
        dedup_hash: "hash_b", title: "Dev", company_name: "CompanyB",
        location: "Ottawa", location_lat: null, location_lng: null,
        description: "Job B", salary_min: null, salary_max: null,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: null, category: null, contract_type: null,
        remote_type: "unknown", posted_at: null, raw_data: {},
      },
    ],
    total: 2,
  }),
}));

describe("aggregateJobSearch", () => {
  it("combines results from both APIs and deduplicates", async () => {
    const params: AggregateSearchParams = { keywords: "analyst", location: "Montreal" };
    const result = await aggregateJobSearch(params);
    expect(result.jobs).toHaveLength(2);
  });

  it("includes tavily results when tavily source is requested", async () => {
    const params: AggregateSearchParams = {
      keywords: "superviseur",
      location: "Montreal",
      sources: ["jsearch", "adzuna", "tavily"],
    };
    const result = await aggregateJobSearch(params);
    expect(result.totalTavily).toBe(1);
    const tavilyJob = result.jobs.find((j) => j.source === "tavily");
    expect(tavilyJob).toBeDefined();
    expect(tavilyJob?.company_name).toBe("GardaWorld");
  });

  it("prefers adzuna version of duplicates (richer data)", async () => {
    const params: AggregateSearchParams = { keywords: "analyst" };
    const result = await aggregateJobSearch(params);
    const analystJob = result.jobs.find((j) => j.dedup_hash === "hash_a");
    expect(analystJob?.source).toBe("adzuna");
    expect(analystJob?.salary_min).toBe(60000);
  });
});
