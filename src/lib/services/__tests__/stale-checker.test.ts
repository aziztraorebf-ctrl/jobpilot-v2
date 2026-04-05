import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/firecrawl", () => ({
  getFirecrawlClient: vi.fn(),
}));

import { getFirecrawlClient } from "@/lib/api/firecrawl";
import { checkJobStillActive } from "../stale-checker";

describe("checkJobStillActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active=true for a normal page", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        markdown: "# Software Developer\n\nWe are looking for a talented developer...",
        metadata: { statusCode: 200 },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await checkJobStillActive("https://example.com/jobs/123");
    expect(result.active).toBe(true);
  });

  it("returns active=false for HTTP 404", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        markdown: "Page not found",
        metadata: { statusCode: 404 },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await checkJobStillActive("https://example.com/jobs/gone");
    expect(result.active).toBe(false);
    expect(result.reason).toContain("404");
  });

  it("returns active=false when page contains 'position has been filled'", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        markdown: "Thank you for your interest. This position has been filled.",
        metadata: { statusCode: 200 },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await checkJobStillActive("https://example.com/jobs/filled");
    expect(result.active).toBe(false);
    expect(result.reason).toContain("position has been filled");
  });

  it("returns active=false for French closed indicator", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        markdown: "Merci de votre interet. Ce poste n'est plus disponible.",
        metadata: { statusCode: 200 },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await checkJobStillActive("https://example.com/jobs/fr");
    expect(result.active).toBe(false);
    expect(result.reason).toContain("plus disponible");
  });

  it("returns active=true when scrape fails (benefit of doubt)", async () => {
    const mockClient = {
      scrape: vi.fn().mockRejectedValue(new Error("Timeout")),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await checkJobStillActive("https://slow-site.com/jobs");
    expect(result.active).toBe(true);
    expect(result.reason).toContain("Could not verify");
  });
});
