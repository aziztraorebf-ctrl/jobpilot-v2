import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats,
} from "../applications";
import {
  createChainBuilder,
  createDoubleEqBuilder,
  createMultiTableMock,
  useMock,
} from "@/test/supabase-mock";

// Mock the Supabase client module
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

const TEST_USER_ID = "test-user-id-1234";

const mockGetSupabase = vi.mocked(getSupabase);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_JOB_LISTING = {
  id: "job-1",
  title: "Senior Developer",
  company_name: "Acme Corp",
  location: "Paris, France",
  source_url: "https://example.com/job/1",
  remote_type: "hybrid",
};

const MOCK_APPLICATION = {
  id: "app-1",
  user_id: "test-user-id-1234",
  job_listing_id: "job-1",
  status: "saved" as const,
  saved_at: "2026-01-10T00:00:00Z",
  applied_at: null,
  interview_at: null,
  offer_at: null,
  closed_at: null,
  resume_id: null,
  cover_letter_id: null,
  application_method: null,
  application_url: null,
  recruiter_name: null,
  recruiter_email: null,
  recruiter_phone: null,
  recruiter_linkedin: null,
  notes: null,
  salary_offered: null,
  priority: 0,
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const MOCK_APPLICATION_WITH_JOB = {
  ...MOCK_APPLICATION,
  job_listings: MOCK_JOB_LISTING,
};

// ---------------------------------------------------------------------------
// Tests: getApplications
// ---------------------------------------------------------------------------

describe("getApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all applications for the user, ordered by updated_at desc", async () => {
    const mockClient = createChainBuilder({
      data: [MOCK_APPLICATION_WITH_JOB],
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getApplications(TEST_USER_ID);

    expect(result).toEqual([MOCK_APPLICATION_WITH_JOB]);
    expect(mockClient.from).toHaveBeenCalledWith("applications");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
  });

  it("returns empty array when no applications exist", async () => {
    const mockClient = createChainBuilder({ data: [], error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await getApplications(TEST_USER_ID);

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Connection refused" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getApplications(TEST_USER_ID)).rejects.toThrow(
      "Failed to fetch applications: Connection refused"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: getApplicationById
// ---------------------------------------------------------------------------

describe("getApplicationById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single application with job data", async () => {
    const mockClient = createChainBuilder({
      data: MOCK_APPLICATION_WITH_JOB,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await getApplicationById(TEST_USER_ID, "app-1");

    expect(result).toEqual(MOCK_APPLICATION_WITH_JOB);
    expect(mockClient.from).toHaveBeenCalledWith("applications");
    expect(mockClient.eq).toHaveBeenCalledWith("id", "app-1");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.single).toHaveBeenCalled();
  });

  it("throws when application is not found", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Row not found" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getApplicationById(TEST_USER_ID, "nonexistent")).rejects.toThrow(
      "Failed to fetch application: Row not found"
    );
  });

  it("throws when id is empty string", async () => {
    await expect(getApplicationById(TEST_USER_ID, "")).rejects.toThrow(
      "Application ID is required"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createApplication
// ---------------------------------------------------------------------------

describe("createApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an application with status saved and returns the row", async () => {
    const mockClient = createChainBuilder({
      data: MOCK_APPLICATION,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    const result = await createApplication(TEST_USER_ID, "job-1");

    expect(result).toEqual(MOCK_APPLICATION);
    expect(mockClient.from).toHaveBeenCalledWith("applications");
    expect(mockClient.insert).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      job_listing_id: "job-1",
      status: "saved",
    });
    expect(mockClient.select).toHaveBeenCalled();
    expect(mockClient.single).toHaveBeenCalled();
  });

  it("throws on Supabase error (e.g. duplicate)", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(createApplication(TEST_USER_ID, "job-1")).rejects.toThrow(
      "Failed to create application: duplicate key value violates unique constraint"
    );
  });

  it("throws when jobListingId is empty string", async () => {
    await expect(createApplication(TEST_USER_ID, "")).rejects.toThrow(
      "Job listing ID is required"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: updateApplicationStatus
// ---------------------------------------------------------------------------

describe("updateApplicationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pin Date.now for deterministic timestamp assertions
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets applied_at when status is 'applied'", async () => {
    const mockClient = createChainBuilder({
      data: { ...MOCK_APPLICATION, status: "applied", applied_at: "2026-02-01T12:00:00.000Z" },
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await updateApplicationStatus(TEST_USER_ID, "app-1", "applied");

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "applied",
        applied_at: "2026-02-01T12:00:00.000Z",
      })
    );
  });

  it("sets interview_at from extra when status is 'interview'", async () => {
    const customDate = "2026-03-15T10:00:00.000Z";
    const mockClient = createChainBuilder({
      data: { ...MOCK_APPLICATION, status: "interview", interview_at: customDate },
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await updateApplicationStatus(TEST_USER_ID, "app-1", "interview", {
      interview_at: customDate,
    });

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "interview",
        interview_at: customDate,
      })
    );
  });

  it("sets interview_at to now if no extra.interview_at provided", async () => {
    const mockClient = createChainBuilder({
      data: { ...MOCK_APPLICATION, status: "interview", interview_at: "2026-02-01T12:00:00.000Z" },
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await updateApplicationStatus(TEST_USER_ID, "app-1", "interview");

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "interview",
        interview_at: "2026-02-01T12:00:00.000Z",
      })
    );
  });

  it("sets offer_at when status is 'offer'", async () => {
    const mockClient = createChainBuilder({
      data: { ...MOCK_APPLICATION, status: "offer", offer_at: "2026-02-01T12:00:00.000Z" },
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await updateApplicationStatus(TEST_USER_ID, "app-1", "offer");

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "offer",
        offer_at: "2026-02-01T12:00:00.000Z",
      })
    );
  });

  it.each(["rejected", "accepted", "withdrawn"])(
    "sets closed_at when status is '%s'",
    async (closedStatus) => {
      const mockClient = createChainBuilder({
        data: { ...MOCK_APPLICATION, status: closedStatus, closed_at: "2026-02-01T12:00:00.000Z" },
        error: null,
      });
      useMock(mockGetSupabase, mockClient);

      await updateApplicationStatus(TEST_USER_ID, "app-1", closedStatus);

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: closedStatus,
          closed_at: "2026-02-01T12:00:00.000Z",
        })
      );
    }
  );

  it("passes extra notes and salary_offered fields", async () => {
    const mockClient = createChainBuilder({
      data: {
        ...MOCK_APPLICATION,
        status: "offer",
        notes: "Great offer!",
        salary_offered: 85000,
      },
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await updateApplicationStatus(TEST_USER_ID, "app-1", "offer", {
      notes: "Great offer!",
      salary_offered: 85000,
    });

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "offer",
        notes: "Great offer!",
        salary_offered: 85000,
        offer_at: "2026-02-01T12:00:00.000Z",
      })
    );
  });

  it("does not set any timestamp for status 'saved'", async () => {
    const mockClient = createChainBuilder({
      data: MOCK_APPLICATION,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await updateApplicationStatus(TEST_USER_ID, "app-1", "saved");

    const updateArg = mockClient.update.mock.calls[0][0];
    expect(updateArg.applied_at).toBeUndefined();
    expect(updateArg.interview_at).toBeUndefined();
    expect(updateArg.offer_at).toBeUndefined();
    expect(updateArg.closed_at).toBeUndefined();
    expect(updateArg.status).toBe("saved");
  });

  it("throws on Supabase error", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Row not found" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(
      updateApplicationStatus(TEST_USER_ID, "app-1", "applied")
    ).rejects.toThrow("Failed to update application status: Row not found");
  });

  it("throws when id is empty", async () => {
    await expect(
      updateApplicationStatus(TEST_USER_ID, "", "applied")
    ).rejects.toThrow("Application ID is required");
  });

  it("throws when status is empty", async () => {
    await expect(
      updateApplicationStatus(TEST_USER_ID, "app-1", "")
    ).rejects.toThrow("Status is required");
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteApplication
// ---------------------------------------------------------------------------

describe("deleteApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls delete with the correct ID and user_id", async () => {
    const { builder: mockClient, innerEq } = createDoubleEqBuilder({ data: null, error: null });
    useMock(mockGetSupabase, mockClient);

    await deleteApplication(TEST_USER_ID, "app-1");

    expect(mockClient.from).toHaveBeenCalledWith("applications");
    expect(mockClient.delete).toHaveBeenCalled();
    expect(mockClient.eq).toHaveBeenCalledWith("id", "app-1");
    expect(innerEq.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
  });

  it("throws on Supabase error", async () => {
    const { builder: mockClient } = createDoubleEqBuilder({
      data: null,
      error: { message: "Foreign key violation" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(deleteApplication(TEST_USER_ID, "app-1")).rejects.toThrow(
      "Failed to delete application: Foreign key violation"
    );
  });

  it("throws when id is empty", async () => {
    await expect(deleteApplication(TEST_USER_ID, "")).rejects.toThrow(
      "Application ID is required"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: getApplicationStats
// ---------------------------------------------------------------------------

describe("getApplicationStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct stats when all data is present", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: 5 },
      { data: null, error: null, count: 2 },
      { data: null, error: null, count: 15 },
      { data: [{ overall_score: 80 }, { overall_score: 90 }, { overall_score: 70 }], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    const stats = await getApplicationStats(TEST_USER_ID);

    expect(stats).toEqual({
      activeApplications: 5,
      upcomingInterviews: 2,
      newJobs: 15,
      avgScore: 80,
    });
  });

  it("returns avgScore 0 when no match scores exist", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: 3 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 10 },
      { data: [], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    const stats = await getApplicationStats(TEST_USER_ID);

    expect(stats.avgScore).toBe(0);
  });

  it("rounds avgScore to one decimal place", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: 1 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: [{ overall_score: 73 }, { overall_score: 68 }], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    const stats = await getApplicationStats(TEST_USER_ID);

    // (73 + 68) / 2 = 70.5
    expect(stats.avgScore).toBe(70.5);
  });

  it("returns 0 for counts when null is returned", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: null },
      { data: null, error: null, count: null },
      { data: null, error: null, count: null },
      { data: [], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    const stats = await getApplicationStats(TEST_USER_ID);

    expect(stats.activeApplications).toBe(0);
    expect(stats.upcomingInterviews).toBe(0);
    expect(stats.newJobs).toBe(0);
  });

  it("throws when active applications query fails", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: { message: "DB timeout" }, count: null },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: [], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    await expect(getApplicationStats(TEST_USER_ID)).rejects.toThrow(
      "Failed to count active applications: DB timeout"
    );
  });

  it("throws when interview count query fails", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: 0 },
      { data: null, error: { message: "Permission denied" }, count: null },
      { data: null, error: null, count: 0 },
      { data: [], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    await expect(getApplicationStats(TEST_USER_ID)).rejects.toThrow(
      "Failed to count upcoming interviews: Permission denied"
    );
  });

  it("throws when new jobs query fails", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: { message: "Table not found" }, count: null },
      { data: [], error: null },
    ]);
    useMock(mockGetSupabase, mockClient);

    await expect(getApplicationStats(TEST_USER_ID)).rejects.toThrow(
      "Failed to count new jobs: Table not found"
    );
  });

  it("throws when match scores query fails", async () => {
    const mockClient = createMultiTableMock([
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: [], error: { message: "Schema mismatch" } },
    ]);
    useMock(mockGetSupabase, mockClient);

    await expect(getApplicationStats(TEST_USER_ID)).rejects.toThrow(
      "Failed to fetch match scores: Schema mismatch"
    );
  });
});
