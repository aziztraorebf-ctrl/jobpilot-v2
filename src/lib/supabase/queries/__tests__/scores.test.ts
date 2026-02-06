import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getScoreMap,
  getScoresForJobs,
  upsertScore,
  getScoreForJob,
} from "../scores";
import { createChainBuilder, useMock } from "@/test/supabase-mock";

// Mock the Supabase client module
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

const mockGetSupabase = vi.mocked(getSupabase);

const TEST_USER_ID = "126d2d02-c032-49b0-a2c8-8a7034b6512f";

// Reusable mock score fixture
const MOCK_SCORE_ROW = {
  id: "score-001",
  user_id: TEST_USER_ID,
  job_listing_id: "job-aaa",
  resume_id: "resume-111",
  overall_score: 82,
  skill_match_score: 75,
  experience_match_score: 90,
  education_match_score: 80,
  explanation: "Strong match on backend skills",
  matching_skills: ["TypeScript", "React", "Node.js"],
  missing_skills: ["Kubernetes"],
  strengths: ["Solid experience with full-stack development"],
  concerns: ["No container orchestration experience"],
  model_used: "gpt-4o-mini",
  tokens_used: 1500,
  created_at: "2026-01-20T00:00:00Z",
};

const MOCK_SCORE_ROW_2 = {
  ...MOCK_SCORE_ROW,
  id: "score-002",
  job_listing_id: "job-bbb",
  overall_score: 65,
  explanation: "Moderate match",
};

/**
 * Wraps a shared chain builder with a `from` method
 * so assertions on mockClient.from still work.
 */
function createMockClient(result: { data: unknown; error: { message: string } | null }) {
  const mockClient = createChainBuilder(result);
  mockClient.from = vi.fn().mockReturnValue(mockClient);
  return mockClient;
}

// ---------------------------------------------------------------------------
// getScoreMap
// ---------------------------------------------------------------------------
describe("getScoreMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object for empty jobIds array (no query)", async () => {
    const result = await getScoreMap(TEST_USER_ID, []);

    expect(result).toEqual({});
    // getSupabase should NOT be called
    expect(mockGetSupabase).not.toHaveBeenCalled();
  });

  it("returns correct job_listing_id -> overall_score mapping", async () => {
    const mockClient = createMockClient({
      data: [
        { job_listing_id: "job-aaa", overall_score: 82 },
        { job_listing_id: "job-bbb", overall_score: 65 },
      ],
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoreMap(TEST_USER_ID, ["job-aaa", "job-bbb"]);

    expect(result).toEqual({
      "job-aaa": 82,
      "job-bbb": 65,
    });
    expect(mockClient.from).toHaveBeenCalledWith("match_scores");
    expect(mockClient.select).toHaveBeenCalledWith(
      "job_listing_id, overall_score"
    );
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.in).toHaveBeenCalledWith("job_listing_id", [
      "job-aaa",
      "job-bbb",
    ]);
  });

  it("returns empty object when no scores found for given jobIds", async () => {
    const mockClient = createMockClient({
      data: [],
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoreMap(TEST_USER_ID, ["job-nonexistent"]);

    expect(result).toEqual({});
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createMockClient({
      data: null,
      error: { message: "Connection refused" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getScoreMap(TEST_USER_ID, ["job-aaa"])).rejects.toThrow(
      "Failed to fetch score map: Connection refused"
    );
  });

  it("handles single jobId correctly", async () => {
    const mockClient = createMockClient({
      data: [{ job_listing_id: "job-aaa", overall_score: 82 }],
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoreMap(TEST_USER_ID, ["job-aaa"]);

    expect(result).toEqual({ "job-aaa": 82 });
    expect(mockClient.in).toHaveBeenCalledWith("job_listing_id", ["job-aaa"]);
  });
});

// ---------------------------------------------------------------------------
// getScoresForJobs
// ---------------------------------------------------------------------------
describe("getScoresForJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty jobIds array (no query)", async () => {
    const result = await getScoresForJobs(TEST_USER_ID, []);

    expect(result).toEqual([]);
    expect(mockGetSupabase).not.toHaveBeenCalled();
  });

  it("returns full score rows for given jobIds", async () => {
    const mockClient = createMockClient({
      data: [MOCK_SCORE_ROW, MOCK_SCORE_ROW_2],
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoresForJobs(TEST_USER_ID, ["job-aaa", "job-bbb"]);

    expect(result).toEqual([MOCK_SCORE_ROW, MOCK_SCORE_ROW_2]);
    expect(result).toHaveLength(2);
    expect(mockClient.from).toHaveBeenCalledWith("match_scores");
    expect(mockClient.select).toHaveBeenCalledWith("*");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.in).toHaveBeenCalledWith("job_listing_id", [
      "job-aaa",
      "job-bbb",
    ]);
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createMockClient({
      data: null,
      error: { message: "Permission denied" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getScoresForJobs(TEST_USER_ID, ["job-aaa"])).rejects.toThrow(
      "Failed to fetch scores for jobs: Permission denied"
    );
  });

  it("returns empty array when no scores exist for the given jobs", async () => {
    const mockClient = createMockClient({
      data: [],
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoresForJobs(TEST_USER_ID, ["job-nonexistent"]);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// upsertScore
// ---------------------------------------------------------------------------
describe("upsertScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls upsert with correct params and returns the upserted row", async () => {
    const mockClient = createMockClient({
      data: MOCK_SCORE_ROW,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const insertData = {
      user_id: TEST_USER_ID,
      job_listing_id: "job-aaa",
      resume_id: "resume-111",
      overall_score: 82,
      skill_match_score: 75,
      experience_match_score: 90,
      education_match_score: 80,
      explanation: "Strong match on backend skills",
      matching_skills: ["TypeScript", "React", "Node.js"],
      missing_skills: ["Kubernetes"],
      strengths: ["Solid experience with full-stack development"],
      concerns: ["No container orchestration experience"],
    };

    const result = await upsertScore(insertData);

    expect(result).toEqual(MOCK_SCORE_ROW);
    expect(mockClient.from).toHaveBeenCalledWith("match_scores");
    expect(mockClient.upsert).toHaveBeenCalledWith(insertData, {
      onConflict: "user_id,job_listing_id,resume_id",
    });
    expect(mockClient.select).toHaveBeenCalled();
    expect(mockClient.single).toHaveBeenCalled();
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createMockClient({
      data: null,
      error: { message: "Foreign key violation" },
    });
    useMock(mockGetSupabase, mockClient);

    const insertData = {
      user_id: TEST_USER_ID,
      job_listing_id: "job-invalid",
      resume_id: "resume-invalid",
      overall_score: 50,
      skill_match_score: null,
      experience_match_score: null,
      education_match_score: null,
      explanation: "Test",
      matching_skills: [],
      missing_skills: [],
      strengths: [],
      concerns: [],
    };

    await expect(upsertScore(insertData)).rejects.toThrow(
      "Failed to upsert score: Foreign key violation"
    );
  });

  it("handles upsert (update existing) correctly", async () => {
    const updatedRow = {
      ...MOCK_SCORE_ROW,
      overall_score: 90,
      explanation: "Updated match analysis",
    };
    const mockClient = createMockClient({
      data: updatedRow,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const insertData = {
      user_id: TEST_USER_ID,
      job_listing_id: "job-aaa",
      resume_id: "resume-111",
      overall_score: 90,
      skill_match_score: 85,
      experience_match_score: 95,
      education_match_score: 90,
      explanation: "Updated match analysis",
      matching_skills: ["TypeScript", "React", "Node.js", "Docker"],
      missing_skills: [],
      strengths: ["Excellent full-stack profile"],
      concerns: [],
    };

    const result = await upsertScore(insertData);

    expect(result.overall_score).toBe(90);
    expect(result.explanation).toBe("Updated match analysis");
    expect(mockClient.upsert).toHaveBeenCalledWith(insertData, {
      onConflict: "user_id,job_listing_id,resume_id",
    });
  });
});

// ---------------------------------------------------------------------------
// getScoreForJob
// ---------------------------------------------------------------------------
describe("getScoreForJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns score row when found", async () => {
    const mockClient = createMockClient({
      data: MOCK_SCORE_ROW,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoreForJob(TEST_USER_ID, "job-aaa", "resume-111");

    expect(result).toEqual(MOCK_SCORE_ROW);
    expect(mockClient.from).toHaveBeenCalledWith("match_scores");
    expect(mockClient.select).toHaveBeenCalledWith("*");
    // eq is called 3 times: user_id, job_listing_id, resume_id
    expect(mockClient.eq).toHaveBeenCalledTimes(3);
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.eq).toHaveBeenCalledWith("job_listing_id", "job-aaa");
    expect(mockClient.eq).toHaveBeenCalledWith("resume_id", "resume-111");
    expect(mockClient.maybeSingle).toHaveBeenCalled();
  });

  it("returns null when no score exists (cache miss)", async () => {
    const mockClient = createMockClient({
      data: null,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getScoreForJob(TEST_USER_ID, "job-new", "resume-111");

    expect(result).toBeNull();
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createMockClient({
      data: null,
      error: { message: "Network timeout" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getScoreForJob(TEST_USER_ID, "job-aaa", "resume-111")).rejects.toThrow(
      "Failed to fetch score for job: Network timeout"
    );
  });

  it("uses maybeSingle instead of single (does not throw on no rows)", async () => {
    const mockClient = createMockClient({
      data: null,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await getScoreForJob(TEST_USER_ID, "job-aaa", "resume-111");

    expect(mockClient.maybeSingle).toHaveBeenCalled();
    // single should NOT have been called
    expect(mockClient.single).not.toHaveBeenCalled();
  });
});
