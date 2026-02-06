import { describe, it, expect } from "vitest";
import { searchJSearch } from "@/lib/api/jsearch";

describe("JSearch API - Integration", () => {
  it("should return jobs for a keyword search in Canada", async () => {
    const result = await searchJSearch({
      query: "full stack developer in Montreal",
      country: "ca",
    });

    expect(result).toBeDefined();
    expect(result.jobs.length).toBeGreaterThan(0);

    console.log(`[JSearch] Jobs returned: ${result.jobs.length}`);

    if (result.jobs.length > 0) {
      const job = result.jobs[0];
      expect(job.title).toBeDefined();
      expect(job.source).toBe("jsearch");
      expect(job.source_url).toBeDefined();
      expect(job.dedup_hash).toBeDefined();
      expect(job.dedup_hash.length).toBe(16);
      console.log(`[JSearch] Sample: "${job.title}" at ${job.company_name || "N/A"}`);
      console.log(`[JSearch] Location: ${job.location || "N/A"}`);
      console.log(`[JSearch] Remote: ${job.remote_type}`);
      if (job.salary_min || job.salary_max) {
        console.log(`[JSearch] Salary: ${job.salary_min || "?"} - ${job.salary_max || "?"} ${job.salary_currency}`);
      }
    }
  });

  it("should return jobs for a French keyword search", async () => {
    const result = await searchJSearch({
      query: "developpeur web Montreal",
      country: "ca",
    });

    expect(result).toBeDefined();
    console.log(`[JSearch FR] Jobs: ${result.jobs.length}`);
  });

  it("should filter remote jobs", async () => {
    const result = await searchJSearch({
      query: "software engineer",
      country: "ca",
      remoteOnly: true,
    });

    expect(result).toBeDefined();
    console.log(`[JSearch Remote] Jobs: ${result.jobs.length}`);

    if (result.jobs.length > 0) {
      const remoteJobs = result.jobs.filter((j) => j.remote_type === "remote");
      console.log(`[JSearch Remote] Jobs marked remote: ${remoteJobs.length}/${result.jobs.length}`);
    }
  });

  it("should filter by date posted", async () => {
    const result = await searchJSearch({
      query: "developer in Montreal",
      country: "ca",
      datePosted: "week",
    });

    expect(result).toBeDefined();
    console.log(`[JSearch Week] Jobs posted this week: ${result.jobs.length}`);
  });

  it("should handle empty results gracefully", async () => {
    const result = await searchJSearch({
      query: "xyznonexistentjobtitle99999",
      country: "ca",
    });

    expect(result).toBeDefined();
    expect(result.jobs).toBeDefined();
    console.log(`[JSearch Empty] Jobs: ${result.jobs.length}`);
  });

  it("should return rich data (description, company, location)", async () => {
    const result = await searchJSearch({
      query: "data analyst in Toronto",
      country: "ca",
    });

    expect(result.jobs.length).toBeGreaterThan(0);

    const job = result.jobs[0];
    console.log(`[JSearch Rich] Title: ${job.title}`);
    console.log(`[JSearch Rich] Company: ${job.company_name || "N/A"}`);
    console.log(`[JSearch Rich] Location: ${job.location || "N/A"}`);
    console.log(`[JSearch Rich] Description length: ${job.description?.length || 0} chars`);
    console.log(`[JSearch Rich] Job type: ${job.job_type || "N/A"}`);
    console.log(`[JSearch Rich] Posted: ${job.posted_at || "N/A"}`);

    // JSearch should provide richer data than Jooble
    expect(job.description).toBeDefined();
    expect(job.description!.length).toBeGreaterThan(50);
  });
});
