import { describe, it, expect } from "vitest";
import {
  JoobleJobSchema,
  AdzunaJobSchema,
  normalizeJoobleJob,
  normalizeAdzunaJob,
  computeDedupHash,
} from "../job";

describe("JoobleJobSchema", () => {
  it("validates a valid Jooble response", () => {
    const raw = {
      title: "Data Analyst",
      company: "Desjardins",
      location: "Montreal, QC",
      salary: "60000",
      snippet: "Nous cherchons un analyste...",
      link: "https://jooble.org/jobs/123",
      type: "Full-time",
      updated: "2026-01-20T10:00:00Z",
      id: "123",
    };
    expect(JoobleJobSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects missing title", () => {
    const raw = { company: "Test", link: "https://example.com" };
    expect(JoobleJobSchema.safeParse(raw).success).toBe(false);
  });
});

describe("AdzunaJobSchema", () => {
  it("validates a valid Adzuna response", () => {
    const raw = {
      id: "456",
      title: "Software Developer",
      company: { display_name: "Shopify" },
      location: { display_name: "Ottawa, ON", area: ["Canada", "Ontario"] },
      salary_min: 70000,
      salary_max: 90000,
      salary_is_predicted: 0,
      description: "Building cool stuff...",
      redirect_url: "https://adzuna.ca/jobs/456",
      created: "2026-01-15T08:00:00Z",
      category: { label: "IT Jobs", tag: "it-jobs" },
      contract_type: "permanent",
      contract_time: "full_time",
    };
    expect(AdzunaJobSchema.safeParse(raw).success).toBe(true);
  });
});

describe("normalizeJoobleJob", () => {
  it("converts Jooble job to UnifiedJob", () => {
    const jooble = {
      title: "Data Analyst",
      company: "Desjardins",
      location: "Montreal, QC",
      salary: "60000-75000",
      snippet: "Nous cherchons un analyste...",
      link: "https://jooble.org/jobs/123",
      type: "Full-time",
      updated: "2026-01-20T10:00:00Z",
      id: "123",
    };
    const unified = normalizeJoobleJob(jooble);
    expect(unified.source).toBe("jooble");
    expect(unified.title).toBe("Data Analyst");
    expect(unified.company_name).toBe("Desjardins");
    expect(unified.source_url).toBe("https://jooble.org/jobs/123");
    expect(unified.dedup_hash).toBeDefined();
  });
});

describe("normalizeAdzunaJob", () => {
  it("converts Adzuna job to UnifiedJob with salary", () => {
    const adzuna = {
      id: "456",
      title: "Software Developer",
      company: { display_name: "Shopify" },
      location: { display_name: "Ottawa, ON", area: ["Canada", "Ontario"] },
      salary_min: 70000,
      salary_max: 90000,
      salary_is_predicted: 0,
      description: "Building cool stuff...",
      redirect_url: "https://adzuna.ca/jobs/456",
      created: "2026-01-15T08:00:00Z",
      category: { label: "IT Jobs", tag: "it-jobs" },
      contract_type: "permanent",
      contract_time: "full_time",
    };
    const unified = normalizeAdzunaJob(adzuna);
    expect(unified.source).toBe("adzuna");
    expect(unified.salary_min).toBe(70000);
    expect(unified.salary_max).toBe(90000);
    expect(unified.category).toBe("IT Jobs");
  });
});

describe("computeDedupHash", () => {
  it("produces same hash for same inputs", () => {
    const h1 = computeDedupHash("Dev", "Acme", "Montreal");
    const h2 = computeDedupHash("Dev", "Acme", "Montreal");
    expect(h1).toBe(h2);
  });

  it("produces different hash for different inputs", () => {
    const h1 = computeDedupHash("Dev", "Acme", "Montreal");
    const h2 = computeDedupHash("Dev", "Acme", "Toronto");
    expect(h1).not.toBe(h2);
  });

  it("is case-insensitive", () => {
    const h1 = computeDedupHash("Data Analyst", "ACME", "montreal");
    const h2 = computeDedupHash("data analyst", "acme", "Montreal");
    expect(h1).toBe(h2);
  });
});
