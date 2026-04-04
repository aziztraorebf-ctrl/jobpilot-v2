import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/firecrawl", () => ({
  getFirecrawlClient: vi.fn(),
}));

import { getFirecrawlClient } from "@/lib/api/firecrawl";
import {
  reconApplicationPage,
  decideApplyStrategy,
  executeApplication,
  type ReconResult,
} from "../browser-apply";

describe("decideApplyStrategy", () => {
  const baseRecon: ReconResult = {
    atsType: "other",
    hasSimpleForm: true,
    requiresAuth: false,
    formFields: ["name", "email"],
    scrapeId: "scrape-123",
  };

  it("returns canAutomate=true for simple forms without auth", () => {
    const result = decideApplyStrategy(baseRecon);
    expect(result.canAutomate).toBe(true);
  });

  it("returns canAutomate=false for LinkedIn", () => {
    const result = decideApplyStrategy({ ...baseRecon, atsType: "linkedin" });
    expect(result.canAutomate).toBe(false);
    expect(result.reason).toContain("linkedin");
  });

  it("returns canAutomate=false for Indeed", () => {
    const result = decideApplyStrategy({ ...baseRecon, atsType: "indeed" });
    expect(result.canAutomate).toBe(false);
    expect(result.reason).toContain("indeed");
  });

  it("returns canAutomate=false for Workday", () => {
    const result = decideApplyStrategy({ ...baseRecon, atsType: "workday" });
    expect(result.canAutomate).toBe(false);
    expect(result.reason).toContain("Workday");
  });

  it("returns canAutomate=false when auth is required", () => {
    const result = decideApplyStrategy({ ...baseRecon, requiresAuth: true });
    expect(result.canAutomate).toBe(false);
    expect(result.reason).toContain("authentication");
  });

  it("returns canAutomate=false when no simple form detected", () => {
    const result = decideApplyStrategy({ ...baseRecon, hasSimpleForm: false });
    expect(result.canAutomate).toBe(false);
    expect(result.reason).toContain("No simple application form");
  });

  it("allows Greenhouse with simple form", () => {
    const result = decideApplyStrategy({ ...baseRecon, atsType: "greenhouse" });
    expect(result.canAutomate).toBe(true);
  });

  it("allows Lever with simple form", () => {
    const result = decideApplyStrategy({ ...baseRecon, atsType: "lever" });
    expect(result.canAutomate).toBe(true);
  });
});

describe("reconApplicationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies LinkedIn from URL", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        json: { ats_system: "unknown", has_form: false, requires_auth: true, form_fields: [] },
        metadata: { scrapeId: "scrape-abc" },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await reconApplicationPage("https://linkedin.com/jobs/view/123");
    expect(result.atsType).toBe("linkedin");
    expect(result.requiresAuth).toBe(true);
    expect(result.scrapeId).toBe("scrape-abc");
  });

  it("classifies Greenhouse from detected ATS", async () => {
    const mockClient = {
      scrape: vi.fn().mockResolvedValue({
        json: { ats_system: "Greenhouse", has_form: true, requires_auth: false, form_fields: ["name", "email", "resume"] },
        metadata: { scrapeId: "scrape-def" },
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await reconApplicationPage("https://boards.greenhouse.io/company/jobs/123");
    expect(result.atsType).toBe("greenhouse");
    expect(result.hasSimpleForm).toBe(true);
    expect(result.formFields).toEqual(["name", "email", "resume"]);
  });
});

describe("executeApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when interact succeeds", async () => {
    const mockClient = {
      interact: vi.fn().mockResolvedValue({
        success: true,
        output: "Form submitted successfully",
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await executeApplication("scrape-123", {
      name: "Aziz Traore",
      email: "aziz@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain("submitted");
  });

  it("returns failure when interact fails", async () => {
    const mockClient = {
      interact: vi.fn().mockResolvedValue({
        success: false,
        error: "Element not found",
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    const result = await executeApplication("scrape-123", {
      name: "Aziz Traore",
      email: "aziz@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Element not found");
  });

  it("includes phone in prompt when provided", async () => {
    const mockClient = {
      interact: vi.fn().mockResolvedValue({
        success: true,
        output: "OK",
      }),
    };
    vi.mocked(getFirecrawlClient).mockReturnValue(mockClient as never);

    await executeApplication("scrape-123", {
      name: "Aziz Traore",
      email: "aziz@example.com",
      phone: "514-555-1234",
    });

    const call = mockClient.interact.mock.calls[0];
    expect(call[1].prompt).toContain("514-555-1234");
  });
});
