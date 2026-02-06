import { describe, it, expect } from "vitest";
import {
  AdzunaJobSchema,
  normalizeAdzunaJob,
  computeDedupHash,
} from "../job";

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
