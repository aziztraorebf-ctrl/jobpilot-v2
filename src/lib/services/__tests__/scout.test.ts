import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/firecrawl", () => ({
  getFirecrawlClient: vi.fn(),
}));

vi.mock("@/lib/api/firecrawl-jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/firecrawl-jobs")>();
  return {
    ...actual,
    normalizeFirecrawlJob: actual.normalizeFirecrawlJob,
    FIRECRAWL_JOB_SCHEMA: actual.FIRECRAWL_JOB_SCHEMA,
  };
});

import { getFirecrawlClient } from "@/lib/api/firecrawl";
import { runScout } from "../scout";

describe("scout — targets mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scrapes URLs and returns normalized jobs", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        json: {
          jobs: [
            { title: "Security Agent", company_name: "STM", location: "Montreal, QC" },
            { title: "Bus Driver", company_name: "STM", location: "Montreal, QC" },
          ],
        },
        metadata: { creditsUsed: 5 },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await runScout({
      mode: "targets",
      urls: ["https://carrieres.stm.info/offres"],
    });

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].source).toBe("firecrawl");
    expect(result.jobs[0].title).toBe("Security Agent");
    expect(result.creditsUsed).toBe(5);
    expect(result.errors).toHaveLength(0);
  });

  it("handles scrape failures gracefully", async () => {
    const mockClient = {
      scrape: vi.fn().mockRejectedValue(new Error("Timeout")),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await runScout({
      mode: "targets",
      urls: ["https://broken-url.com"],
    });

    expect(result.jobs).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Timeout");
  });

  it("handles single job response (not array)", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        json: { title: "Guard", company_name: "Mall", location: "Laval" },
        metadata: { creditsUsed: 3 },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await runScout({
      mode: "targets",
      urls: ["https://example.com/careers"],
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Guard");
  });
});

describe("scout — search mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches and returns jobs with JSON extraction", async () => {
    const mockClient = {
      search: vi.fn().mockResolvedValue({
        web: [
          {
            url: "https://indeed.com/job/123",
            json: { title: "Warehouse Clerk", company_name: "Acme", location: "Montreal" },
            metadata: { creditsUsed: 5 },
          },
          {
            url: "https://linkedin.com/jobs",
            title: "LinkedIn listing",
            // No json — LinkedIn blocks extraction
          },
        ],
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await runScout({
      mode: "search",
      keywords: "warehouse clerk",
      location: "Montreal",
      limit: 5,
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Warehouse Clerk");
    expect(result.creditsUsed).toBe(5);
  });
});

describe("scout — agent mode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs agent and returns extracted jobs", async () => {
    const mockClient = {
      agent: vi.fn().mockResolvedValue({
        success: true,
        status: "completed",
        data: {
          jobs: [
            { title: "Coordinator", company_name: "City of Montreal", location: "Montreal", application_url: "https://ville.montreal.qc.ca/apply" },
          ],
        },
        creditsUsed: 15,
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await runScout({
      mode: "agent",
      prompt: "Find all open positions at City of Montreal paying $20-25/hour",
      maxCredits: 30,
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Coordinator");
    expect(result.jobs[0].source_url).toBe("https://ville.montreal.qc.ca/apply");
    expect(result.creditsUsed).toBe(15);
  });

  it("handles agent failure", async () => {
    const mockClient = {
      agent: vi.fn().mockResolvedValue({
        success: false,
        status: "failed",
        error: "Credit limit exceeded",
        creditsUsed: 50,
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await runScout({
      mode: "agent",
      prompt: "Find jobs",
      maxCredits: 50,
    });

    expect(result.jobs).toHaveLength(0);
    expect(result.errors[0]).toContain("Credit limit exceeded");
    expect(result.creditsUsed).toBe(50);
  });
});
