import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/cron-auth", () => ({
  verifyCronSecret: vi.fn(),
  unauthorizedResponse: vi.fn(
    () => new Response("Unauthorized", { status: 401 })
  ),
}));

vi.mock("@/lib/supabase/queries", () => ({
  getProfile: vi.fn(),
  getStaleApplications: vi.fn(() => []),
  getProfilesWithAutoSearch: vi.fn(() => [{ id: "user-1" }]),
}));

vi.mock("@/lib/supabase/queries/cowork", () => ({
  getDashboardCounts: vi.fn(() => ({
    activeJobs: 50,
    totalApplications: 10,
    statusCounts: { saved: 5, applied: 3, interview: 2 },
  })),
  getRecentJobCount: vi.fn(() => 20),
  getUnseenJobCount: vi.fn(() => 30),
  getTopScoredUnseenJobs: vi.fn(() => []),
}));

import { verifyCronSecret } from "@/lib/api/cron-auth";
import {
  getUnseenJobCount,
  getRecentJobCount,
  getTopScoredUnseenJobs,
} from "@/lib/supabase/queries/cowork";
import { getStaleApplications } from "@/lib/supabase/queries";

describe("GET /api/cowork/next-actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(verifyCronSecret).mockReturnValue(true);
  });

  it("returns 401 without valid cron secret", async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions")
    );
    expect(res.status).toBe(401);
  });

  it("returns fetch_jobs action when unseen count is low", async () => {
    vi.mocked(getUnseenJobCount).mockResolvedValue(5);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    expect(
      json.actions.some((a: { type: string }) => a.type === "fetch_jobs")
    ).toBe(true);
  });

  it("returns fetch_jobs when no jobs fetched in 24h", async () => {
    vi.mocked(getRecentJobCount).mockResolvedValue(0);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    const fetchAction = json.actions.find(
      (a: { type: string }) => a.type === "fetch_jobs"
    );
    expect(fetchAction).toBeDefined();
    expect(fetchAction.reason).toContain("No jobs fetched");
  });

  it("returns apply_high_match when high-scored jobs exist", async () => {
    vi.mocked(getTopScoredUnseenJobs).mockResolvedValue([
      {
        job_listing_id: "j1",
        title: "Dev",
        company_name: "ACME",
        source_url: "http://example.com",
        overall_score: 85,
      },
    ]);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    expect(
      json.actions.some((a: { type: string }) => a.type === "apply_high_match")
    ).toBe(true);
  });

  it("returns review_stale when stale applications exist", async () => {
    vi.mocked(getStaleApplications).mockResolvedValue([
      {
        id: "a1",
        status: "applied",
        updated_at: "2026-03-20",
        job_listings: { title: "Job", company_name: "Co" },
      },
    ] as never);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    expect(
      json.actions.some((a: { type: string }) => a.type === "review_stale")
    ).toBe(true);
  });

  it("returns idle when nothing to do", async () => {
    vi.mocked(getUnseenJobCount).mockResolvedValue(30);
    vi.mocked(getRecentJobCount).mockResolvedValue(20);
    vi.mocked(getTopScoredUnseenJobs).mockResolvedValue([]);
    vi.mocked(getStaleApplications).mockResolvedValue([]);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    expect(json.actions).toHaveLength(1);
    expect(json.actions[0].type).toBe("idle");
  });

  it("sorts actions by priority (high first)", async () => {
    vi.mocked(getUnseenJobCount).mockResolvedValue(5);
    vi.mocked(getTopScoredUnseenJobs).mockResolvedValue([
      {
        job_listing_id: "j1",
        title: "Dev",
        company_name: "ACME",
        source_url: "http://example.com",
        overall_score: 85,
      },
    ]);
    vi.mocked(getStaleApplications).mockResolvedValue([
      {
        id: "a1",
        status: "applied",
        updated_at: "2026-03-20",
        job_listings: { title: "Job", company_name: "Co" },
      },
    ] as never);
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    const priorities = json.actions.map(
      (a: { priority: string }) => a.priority
    );
    const highIdx = priorities.indexOf("high");
    const medIdx = priorities.indexOf("medium");
    expect(highIdx).toBeLessThan(medIdx);
  });

  it("includes context and generatedAt in response", async () => {
    const { GET } = await import("../next-actions/route");
    const res = await GET(
      new Request("http://localhost/api/cowork/next-actions", {
        headers: { Authorization: "Bearer test" },
      })
    );
    const json = await res.json();
    expect(json.context).toBeDefined();
    expect(json.context.unseenJobCount).toBeDefined();
    expect(json.context.activeJobs).toBeDefined();
    expect(json.context.totalApplications).toBeDefined();
    expect(json.context.statusCounts).toBeDefined();
    expect(json.generatedAt).toBeDefined();
  });
});
