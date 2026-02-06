import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPrimaryResume,
  getResumes,
  createResume,
  updateResume,
  deleteResume,
} from "../resumes";
import {
  createChainBuilder,
  createDoubleEqBuilder,
  useMock,
  useMockOnce,
} from "@/test/supabase-mock";

// Mock the Supabase client module
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

const mockGetSupabase = vi.mocked(getSupabase);

const TEST_USER_ID = "126d2d02-c032-49b0-a2c8-8a7034b6512f";

// Reusable mock resume fixture
const MOCK_RESUME = {
  id: "aaa11111-1111-1111-1111-111111111111",
  user_id: TEST_USER_ID,
  file_name: "cv-aziz-2026.pdf",
  file_path: "/resumes/cv-aziz-2026.pdf",
  file_type: "pdf" as const,
  raw_text: "Parsed resume content here",
  parsed_data: { skills: ["TypeScript", "React"] },
  is_primary: true,
  ai_tokens_used: 250,
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-01-15T10:00:00Z",
};

const MOCK_RESUME_SECONDARY = {
  ...MOCK_RESUME,
  id: "bbb22222-2222-2222-2222-222222222222",
  file_name: "cv-aziz-old.docx",
  file_path: "/resumes/cv-aziz-old.docx",
  file_type: "docx" as const,
  is_primary: false,
  ai_tokens_used: 100,
  created_at: "2026-01-10T10:00:00Z",
  updated_at: "2026-01-10T10:00:00Z",
};

// ---------------------------------------------------------------------------
// getPrimaryResume
// ---------------------------------------------------------------------------
describe("getPrimaryResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a resume when a primary exists", async () => {
    const mockClient = createChainBuilder({ data: MOCK_RESUME, error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await getPrimaryResume(TEST_USER_ID);

    expect(result).toEqual(MOCK_RESUME);
    expect(mockClient.from).toHaveBeenCalledWith("resumes");
    expect(mockClient.select).toHaveBeenCalledWith("*");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.eq).toHaveBeenCalledWith("is_primary", true);
    expect(mockClient.maybeSingle).toHaveBeenCalled();
  });

  it("returns null when no primary resume exists", async () => {
    const mockClient = createChainBuilder({ data: null, error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await getPrimaryResume(TEST_USER_ID);

    expect(result).toBeNull();
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Connection refused" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getPrimaryResume(TEST_USER_ID)).rejects.toThrow(
      "Failed to fetch primary resume: Connection refused"
    );
  });
});

// ---------------------------------------------------------------------------
// getResumes
// ---------------------------------------------------------------------------
describe("getResumes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns array of resumes ordered by created_at DESC", async () => {
    const resumes = [MOCK_RESUME, MOCK_RESUME_SECONDARY];
    const mockClient = createChainBuilder({ data: resumes, error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await getResumes(TEST_USER_ID);

    expect(result).toEqual(resumes);
    expect(result).toHaveLength(2);
    expect(mockClient.from).toHaveBeenCalledWith("resumes");
    expect(mockClient.select).toHaveBeenCalledWith("*");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("returns empty array when no resumes exist", async () => {
    const mockClient = createChainBuilder({ data: [], error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await getResumes(TEST_USER_ID);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when data is null", async () => {
    const mockClient = createChainBuilder({ data: null, error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await getResumes(TEST_USER_ID);

    expect(result).toEqual([]);
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Timeout" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(getResumes(TEST_USER_ID)).rejects.toThrow(
      "Failed to fetch resumes: Timeout"
    );
  });
});

// ---------------------------------------------------------------------------
// createResume
// ---------------------------------------------------------------------------
describe("createResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a resume without unsetting primaries when is_primary is false/undefined", async () => {
    const insertData = {
      user_id: TEST_USER_ID,
      file_name: "new-cv.pdf",
      file_path: "/resumes/new-cv.pdf",
      file_type: "pdf" as const,
    };

    const createdResume = {
      ...MOCK_RESUME_SECONDARY,
      ...insertData,
      id: "ccc33333-3333-3333-3333-333333333333",
      is_primary: false,
      raw_text: null,
      parsed_data: {},
      ai_tokens_used: 0,
    };

    const mockClient = createChainBuilder({ data: createdResume, error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await createResume(TEST_USER_ID, insertData);

    expect(result).toEqual(createdResume);
    expect(mockClient.from).toHaveBeenCalledWith("resumes");
    expect(mockClient.insert).toHaveBeenCalledWith({
      ...insertData,
      user_id: TEST_USER_ID,
    });
    expect(mockClient.select).toHaveBeenCalled();
    expect(mockClient.single).toHaveBeenCalled();

    // getSupabase should be called only ONCE (no unset call)
    expect(mockGetSupabase).toHaveBeenCalledTimes(1);
  });

  it("unsets other primaries before creating when is_primary is true", async () => {
    const insertData = {
      user_id: TEST_USER_ID,
      file_name: "primary-cv.pdf",
      file_path: "/resumes/primary-cv.pdf",
      file_type: "pdf" as const,
      is_primary: true,
    };

    const createdResume = {
      ...MOCK_RESUME,
      ...insertData,
      id: "ddd44444-4444-4444-4444-444444444444",
    };

    // First call: unsetAllPrimaries
    // Chain: .from("resumes").update({is_primary:false}).eq("user_id", ...).eq("is_primary", true)
    const { builder: unsetChain, innerEq: unsetInnerEq } = createDoubleEqBuilder({
      data: null,
      error: null,
    });

    // Second call: createResume insert chain
    const insertClient = createChainBuilder({
      data: createdResume,
      error: null,
    });

    useMockOnce(mockGetSupabase, unsetChain);
    useMockOnce(mockGetSupabase, insertClient);

    const result = await createResume(TEST_USER_ID, insertData);

    expect(result).toEqual(createdResume);
    // getSupabase called twice: once for unset, once for insert
    expect(mockGetSupabase).toHaveBeenCalledTimes(2);
    // Unset chain assertions
    expect(unsetChain.from).toHaveBeenCalledWith("resumes");
    expect(unsetChain.update).toHaveBeenCalledWith({ is_primary: false });
    expect(unsetChain.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(unsetInnerEq.eq).toHaveBeenCalledWith("is_primary", true);
    // Insert chain assertions
    expect(insertClient.from).toHaveBeenCalledWith("resumes");
    expect(insertClient.insert).toHaveBeenCalledWith({
      ...insertData,
      user_id: TEST_USER_ID,
    });
  });

  it("throws Error when unset primaries fails", async () => {
    const insertData = {
      user_id: TEST_USER_ID,
      file_name: "primary-cv.pdf",
      file_path: "/resumes/primary-cv.pdf",
      file_type: "pdf" as const,
      is_primary: true,
    };

    const { builder: unsetChain } = createDoubleEqBuilder({
      data: null,
      error: { message: "Unset failed" },
    });

    useMockOnce(mockGetSupabase, unsetChain);

    await expect(createResume(TEST_USER_ID, insertData)).rejects.toThrow(
      "Failed to unset primary resumes: Unset failed"
    );
  });

  it("throws Error when insert fails", async () => {
    const insertData = {
      user_id: TEST_USER_ID,
      file_name: "bad-cv.pdf",
      file_path: "/resumes/bad-cv.pdf",
      file_type: "pdf" as const,
    };

    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Constraint violation" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(createResume(TEST_USER_ID, insertData)).rejects.toThrow(
      "Failed to create resume: Constraint violation"
    );
  });
});

// ---------------------------------------------------------------------------
// updateResume
// ---------------------------------------------------------------------------
describe("updateResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a resume and returns the updated row", async () => {
    const updatedResume = {
      ...MOCK_RESUME,
      file_name: "cv-renamed.pdf",
      updated_at: "2026-01-20T10:00:00Z",
    };
    const mockClient = createChainBuilder({ data: updatedResume, error: null });
    useMock(mockGetSupabase, mockClient);

    const result = await updateResume(TEST_USER_ID, MOCK_RESUME.id, {
      file_name: "cv-renamed.pdf",
    });

    expect(result).toEqual(updatedResume);
    expect(mockClient.from).toHaveBeenCalledWith("resumes");
    expect(mockClient.update).toHaveBeenCalledWith({
      file_name: "cv-renamed.pdf",
    });
    expect(mockClient.eq).toHaveBeenCalledWith("id", MOCK_RESUME.id);
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockClient.select).toHaveBeenCalled();
    expect(mockClient.single).toHaveBeenCalled();
    // No unset call: getSupabase called once
    expect(mockGetSupabase).toHaveBeenCalledTimes(1);
  });

  it("unsets other primaries before updating when setting is_primary=true", async () => {
    const updatedResume = {
      ...MOCK_RESUME_SECONDARY,
      is_primary: true,
      updated_at: "2026-01-20T10:00:00Z",
    };

    // Unset mock with .eq().eq() chain
    const { builder: unsetChain, innerEq: unsetInnerEq } = createDoubleEqBuilder({
      data: null,
      error: null,
    });

    const updateClient = createChainBuilder({
      data: updatedResume,
      error: null,
    });

    useMockOnce(mockGetSupabase, unsetChain);
    useMockOnce(mockGetSupabase, updateClient);

    const result = await updateResume(TEST_USER_ID, MOCK_RESUME_SECONDARY.id, {
      is_primary: true,
    });

    expect(result).toEqual(updatedResume);
    expect(mockGetSupabase).toHaveBeenCalledTimes(2);
    expect(unsetChain.from).toHaveBeenCalledWith("resumes");
    expect(unsetChain.update).toHaveBeenCalledWith({ is_primary: false });
    expect(unsetInnerEq.eq).toHaveBeenCalledWith("is_primary", true);
    expect(updateClient.update).toHaveBeenCalledWith({ is_primary: true });
  });

  it("throws Error when Supabase returns an error", async () => {
    const mockClient = createChainBuilder({
      data: null,
      error: { message: "Not found" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(
      updateResume(TEST_USER_ID, "nonexistent-id", { file_name: "x.pdf" })
    ).rejects.toThrow("Failed to update resume: Not found");
  });
});

// ---------------------------------------------------------------------------
// deleteResume
// ---------------------------------------------------------------------------
describe("deleteResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a resume by ID with user_id filter", async () => {
    // delete chain: .from().delete().eq("id", ...).eq("user_id", ...) -> resolves
    const { builder: mockClient, innerEq } = createDoubleEqBuilder({
      data: null,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await expect(deleteResume(TEST_USER_ID, MOCK_RESUME.id)).resolves.toBeUndefined();
    expect(mockClient.from).toHaveBeenCalledWith("resumes");
    expect(mockClient.delete).toHaveBeenCalled();
    expect(mockClient.eq).toHaveBeenCalledWith("id", MOCK_RESUME.id);
    expect(innerEq.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
  });

  it("throws Error when Supabase returns an error", async () => {
    const { builder: mockClient } = createDoubleEqBuilder({
      data: null,
      error: { message: "Foreign key violation" },
    });
    useMock(mockGetSupabase, mockClient);

    await expect(deleteResume(TEST_USER_ID, MOCK_RESUME.id)).rejects.toThrow(
      "Failed to delete resume: Foreign key violation"
    );
  });

  it("calls Supabase with the exact id and user_id parameters", async () => {
    const customId = "eeeeeeee-ffff-0000-1111-222222222222";
    const { builder: mockClient, innerEq } = createDoubleEqBuilder({
      data: null,
      error: null,
    });
    useMock(mockGetSupabase, mockClient);

    await deleteResume(TEST_USER_ID, customId);

    expect(mockClient.eq).toHaveBeenCalledWith("id", customId);
    expect(innerEq.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
  });
});
