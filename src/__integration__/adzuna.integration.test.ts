import { describe, it, expect } from "vitest";
import { searchAdzuna } from "@/lib/api/adzuna";

describe("Adzuna API - Integration", () => {
  it("should return jobs for a valid keyword search", async () => {
    const result = await searchAdzuna({ keywords: "developer", location: "Toronto" });

    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.jobs)).toBe(true);

    console.log(`[Adzuna] Total results reported: ${result.total}`);
    console.log(`[Adzuna] Jobs returned (normalized): ${result.jobs.length}`);

    if (result.jobs.length > 0) {
      const job = result.jobs[0];
      expect(job.title).toBeDefined();
      expect(job.source).toBe("adzuna");
      expect(job.source_url).toBeDefined();
      expect(job.dedup_hash).toBeDefined();
      expect(job.dedup_hash.length).toBe(16);

      console.log(`[Adzuna] Sample job: "${job.title}" at ${job.company_name || "N/A"}`);
      if (job.salary_min || job.salary_max) {
        console.log(`[Adzuna] Salary: ${job.salary_min || "?"} - ${job.salary_max || "?"}`);
      }
    }
  });

  it("should handle search with salary filters", async () => {
    const result = await searchAdzuna({
      keywords: "software engineer",
      salaryMin: 60000,
      resultsPerPage: 5,
    });

    expect(result).toBeDefined();
    console.log(`[Adzuna Salary] Total: ${result.total}, Jobs: ${result.jobs.length}`);
  });

  it("should handle search with sort and maxDaysOld", async () => {
    const result = await searchAdzuna({
      keywords: "data analyst",
      sortBy: "date",
      maxDaysOld: 7,
      resultsPerPage: 5,
    });

    expect(result).toBeDefined();
    console.log(`[Adzuna Recent] Total: ${result.total}, Jobs: ${result.jobs.length}`);
  });

  it("should handle empty results gracefully", async () => {
    const result = await searchAdzuna({
      keywords: "xyznonexistentjob123456789",
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.jobs)).toBe(true);
    console.log(`[Adzuna Empty] Total: ${result.total}, Jobs: ${result.jobs.length}`);
  });

  it("should respect resultsPerPage parameter", async () => {
    const result = await searchAdzuna({
      keywords: "developer",
      resultsPerPage: 3,
    });

    expect(result).toBeDefined();
    expect(result.jobs.length).toBeLessThanOrEqual(3);
    console.log(`[Adzuna Limited] Requested max 3, got: ${result.jobs.length}`);
  });

  it("should use configured country (ca)", async () => {
    expect(process.env.ADZUNA_COUNTRY).toBe("ca");
    const result = await searchAdzuna({ keywords: "developer", resultsPerPage: 2 });
    expect(result).toBeDefined();
    console.log(`[Adzuna Country] Using country: ${process.env.ADZUNA_COUNTRY}`);
  });
});
