import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase/get-user", () => ({
  requireUser: vi.fn(() => ({ id: "user-1" })),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/queries", () => ({
  getResumeById: vi.fn(),
  updateResume: vi.fn(),
  getActiveJobsByIds: vi.fn(() => []),
}));

vi.mock("@/lib/supabase/queries/scores", () => ({
  getJobIdsByResumeId: vi.fn(() => []),
}));

vi.mock("@/lib/services/cv-parser", () => ({
  parseCvText: vi.fn(() => ({ parsed: { personal: {}, skills: {} }, tokensUsed: 100 })),
}));

vi.mock("@/lib/services/auto-scorer", () => ({
  scoreJobsForProfile: vi.fn(() => ({})),
}));

vi.mock("@/lib/api/ai-route-helpers", () => ({
  enforceAiRateLimit: vi.fn(() => null),
  parseJsonBody: vi.fn(async (req: Request) => ({ data: await req.json(), error: null })),
}));

import { POST } from "../analyze-cv/route";
import { getResumeById, getActiveJobsByIds } from "@/lib/supabase/queries";
import { getJobIdsByResumeId } from "@/lib/supabase/queries/scores";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";

const RESUME_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("analyze-cv score refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: resume exists with raw_text
    vi.mocked(getResumeById).mockResolvedValue({
      id: RESUME_UUID,
      user_id: "user-1",
      raw_text: "Software engineer with 5 years experience in React and Node.js...",
      parsed_data: null,
      file_path: "user-1/cv.txt",
      file_type: "txt",
      file_name: "cv.txt",
      is_primary: true,
      ai_tokens_used: 0,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    } as never);
  });

  it("triggers re-scoring when resumeId is provided and jobs exist", async () => {
    vi.mocked(getJobIdsByResumeId).mockResolvedValue(["job-1", "job-2"]);
    vi.mocked(getActiveJobsByIds).mockResolvedValue([
      { id: "job-1", title: "Dev", description: "React developer needed" },
      { id: "job-2", title: "SRE", description: "Site reliability engineer" },
    ] as never);

    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: RESUME_UUID }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait for fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(getJobIdsByResumeId).toHaveBeenCalledWith("user-1", RESUME_UUID);
    expect(getActiveJobsByIds).toHaveBeenCalledWith(["job-1", "job-2"]);
    expect(scoreJobsForProfile).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining([
        expect.objectContaining({ id: "job-1" }),
        expect.objectContaining({ id: "job-2" }),
      ]),
      RESUME_UUID
    );
  });

  it("does not trigger re-scoring when no jobs were previously scored", async () => {
    vi.mocked(getJobIdsByResumeId).mockResolvedValue([]);

    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: RESUME_UUID }),
    });

    await POST(req);
    await new Promise((r) => setTimeout(r, 50));

    expect(scoreJobsForProfile).not.toHaveBeenCalled();
  });

  it("does not trigger re-scoring for rawText mode (no resumeId)", async () => {
    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "Software engineer with extensive experience in building web applications and distributed systems..." }),
    });

    await POST(req);
    await new Promise((r) => setTimeout(r, 50));

    expect(getJobIdsByResumeId).not.toHaveBeenCalled();
    expect(scoreJobsForProfile).not.toHaveBeenCalled();
  });

  it("caps re-scoring at MAX_RESCORE_JOBS", async () => {
    const manyJobIds = Array.from({ length: 20 }, (_, i) => `job-${i}`);
    vi.mocked(getJobIdsByResumeId).mockResolvedValue(manyJobIds);
    vi.mocked(getActiveJobsByIds).mockResolvedValue(
      manyJobIds.map((id) => ({ id, title: `Job ${id}`, description: "desc" })) as never
    );

    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: RESUME_UUID }),
    });

    await POST(req);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(scoreJobsForProfile).mock.calls[0][1]).toHaveLength(10);
  });
});
