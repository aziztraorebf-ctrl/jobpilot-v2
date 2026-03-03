import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreJobsForProfile } from "../auto-scorer";

vi.mock("@/lib/supabase/queries/resumes", () => ({
  getPrimaryResume: vi.fn(),
}));
vi.mock("@/lib/services/match-scorer", () => ({
  scoreMatch: vi.fn(),
}));
vi.mock("@/lib/supabase/queries/scores", () => ({
  upsertScore: vi.fn(),
}));
vi.mock("@/lib/api/ai-route-helpers", () => ({
  extractCvData: vi.fn().mockReturnValue({
    skills: { technical: ["TypeScript"], soft: [], languages: [] },
    experience: [],
    summary: "Experienced dev",
  }),
}));

import { getPrimaryResume } from "@/lib/supabase/queries/resumes";
import { scoreMatch } from "@/lib/services/match-scorer";
import { upsertScore } from "@/lib/supabase/queries/scores";

const mockResume = {
  id: "resume-1",
  user_id: "user-1",
  parsed_data: { skills: { technical: ["TypeScript"], soft: [], languages: [] }, experience: [], summary: "Dev" },
  is_primary: true,
};

const mockJobs = [
  { id: "job-1", description: "We need a TypeScript developer", title: "Dev" },
  { id: "job-2", description: "Looking for a manager", title: "Manager" },
];

const mockScore = {
  overall_score: 75,
  skill_match_score: 80,
  experience_match_score: 70,
  education_match_score: 65,
  explanation: "Good match",
  matching_skills: ["TypeScript"],
  missing_skills: [],
  strengths: ["Strong TypeScript"],
  concerns: [],
};

describe("scoreJobsForProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrimaryResume).mockResolvedValue(mockResume as any);
    vi.mocked(scoreMatch).mockResolvedValue({ score: mockScore, tokensUsed: 100 });
    vi.mocked(upsertScore).mockResolvedValue({} as any);
  });

  it("retourne un scoreMap vide si aucun job", async () => {
    const result = await scoreJobsForProfile("user-1", []);
    expect(result).toEqual({});
    expect(scoreMatch).not.toHaveBeenCalled();
  });

  it("retourne un scoreMap vide si pas de CV primaire", async () => {
    vi.mocked(getPrimaryResume).mockResolvedValue(null);
    const result = await scoreJobsForProfile("user-1", mockJobs);
    expect(result).toEqual({});
    expect(scoreMatch).not.toHaveBeenCalled();
  });

  it("retourne un scoreMap vide si CV sans parsed_data", async () => {
    vi.mocked(getPrimaryResume).mockResolvedValue({ ...mockResume, parsed_data: null } as any);
    const result = await scoreJobsForProfile("user-1", mockJobs);
    expect(result).toEqual({});
    expect(scoreMatch).not.toHaveBeenCalled();
  });

  it("score chaque job et retourne le scoreMap", async () => {
    const result = await scoreJobsForProfile("user-1", mockJobs);
    expect(scoreMatch).toHaveBeenCalledTimes(2);
    expect(upsertScore).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ "job-1": 75, "job-2": 75 });
  });

  it("ignore les jobs sans description", async () => {
    const jobs = [
      { id: "job-1", description: "Need TypeScript dev", title: "Dev" },
      { id: "job-2", description: "", title: "Empty" },
      { id: "job-3", description: null, title: "Null" },
    ];
    const result = await scoreJobsForProfile("user-1", jobs as any);
    expect(scoreMatch).toHaveBeenCalledTimes(1);
    expect(result["job-1"]).toBe(75);
    expect(result["job-2"]).toBeUndefined();
    expect(result["job-3"]).toBeUndefined();
  });

  it("continue si un job échoue (résistance aux erreurs)", async () => {
    vi.mocked(scoreMatch)
      .mockRejectedValueOnce(new Error("OpenAI timeout"))
      .mockResolvedValueOnce({ score: mockScore, tokensUsed: 100 });
    const result = await scoreJobsForProfile("user-1", mockJobs);
    expect(scoreMatch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ "job-2": 75 });
  });

  it("continue si upsertScore échoue", async () => {
    vi.mocked(upsertScore)
      .mockRejectedValueOnce(new Error("DB write error"))
      .mockResolvedValueOnce({} as any);
    const result = await scoreJobsForProfile("user-1", mockJobs);
    expect(scoreMatch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ "job-2": 75 });
  });

  it("upsertScore reçoit les bons paramètres", async () => {
    await scoreJobsForProfile("user-1", [mockJobs[0]]);
    expect(upsertScore).toHaveBeenCalledWith({
      user_id: "user-1",
      job_listing_id: "job-1",
      resume_id: "resume-1",
      overall_score: 75,
      skill_match_score: 80,
      experience_match_score: 70,
      education_match_score: 65,
      explanation: "Good match",
      matching_skills: ["TypeScript"],
      missing_skills: [],
      strengths: ["Strong TypeScript"],
      concerns: [],
    });
  });
});
