import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/tavily", () => ({
  getTavilyClient: vi.fn().mockReturnValue({
    search: vi.fn().mockResolvedValue({
      results: [
        {
          title: "Security Supervisor - GardaWorld | Jobillico",
          url: "https://www.jobillico.com/offer/123",
          content:
            "GardaWorld is hiring a Security Supervisor in Montreal. Requirements: BSP, bilingual FR/EN, 3+ years experience. Full-time, $25-30/hr.",
          score: 0.95,
        },
        {
          title: "Superviseur entrepot - Amazon | Jobboom",
          url: "https://www.jobboom.com/offer/456",
          content:
            "Amazon recherche un superviseur d'entrepot a Lachine. Temps plein, avantages sociaux.",
          score: 0.88,
        },
      ],
    }),
  }),
  isTavilyAvailable: vi.fn().mockReturnValue(true),
}));

describe("searchTavily", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns normalized UnifiedJob array from Tavily results", async () => {
    const { searchTavily } = await import("../tavily-jobs");
    const result = await searchTavily({
      keywords: "Security Supervisor",
      location: "Montreal",
    });

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].source).toBe("tavily");
    expect(result.jobs[0].title).toBe("Security Supervisor - GardaWorld");
    expect(result.jobs[0].source_url).toBe(
      "https://www.jobillico.com/offer/123"
    );
    expect(result.jobs[0].description).toContain("GardaWorld");
    expect(result.jobs[0].dedup_hash).toBeTruthy();
  });

  it("filters out results without meaningful content", async () => {
    const { getTavilyClient } = await import("@/lib/api/tavily");
    vi.mocked(getTavilyClient).mockReturnValue({
      search: vi.fn().mockResolvedValue({
        results: [
          { title: "", url: "https://example.com", content: "", score: 0.5 },
        ],
      }),
    } as never);

    const { searchTavily } = await import("../tavily-jobs");
    const result = await searchTavily({ keywords: "test" });
    expect(result.jobs).toHaveLength(0);
  });

  it("passes include_domains and exclude_domains to Tavily", async () => {
    const { getTavilyClient } = await import("@/lib/api/tavily");
    const mockSearch = vi.fn().mockResolvedValue({ results: [] });
    vi.mocked(getTavilyClient).mockReturnValue({ search: mockSearch } as never);

    const { searchTavily } = await import("../tavily-jobs");
    await searchTavily({ keywords: "test", location: "Montreal" });

    expect(mockSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        includeDomains: expect.arrayContaining(["jobillico.com"]),
        excludeDomains: expect.arrayContaining(["indeed.com"]),
      })
    );
  });
});
