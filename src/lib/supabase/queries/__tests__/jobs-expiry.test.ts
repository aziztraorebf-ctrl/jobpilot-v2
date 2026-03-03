import { describe, it, expect, vi, beforeEach } from "vitest";
import { expireOldJobs } from "../jobs";

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

describe("expireOldJobs", () => {
  it("est une fonction exportée", () => {
    expect(typeof expireOldJobs).toBe("function");
  });

  it("retourne un objet avec expired count", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "seen_jobs") {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ error: null, count: 3 }),
            }),
          }),
        };
      }),
    };
    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
    const result = await expireOldJobs();
    expect(result).toHaveProperty("expired");
    expect(typeof result.expired).toBe("number");
  });

  it("expire les jobs non-vus quand des seen_jobs existent", async () => {
    // Chain for unseen expiry: .update().eq().lt().not() -> resolves
    const mockNotChain = vi.fn().mockResolvedValue({ error: null, count: 5 });
    const mockLtChain = vi.fn().mockReturnValue({ not: mockNotChain });
    const mockEqChain = vi.fn().mockReturnValue({ lt: mockLtChain });
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockEqChain });

    // First job_listings call (absolute expiry): .update().eq().lt() -> resolves
    const mockLtAbsolute = vi.fn().mockResolvedValue({ error: null, count: 2 });
    const mockEqAbsolute = vi.fn().mockReturnValue({ lt: mockLtAbsolute });
    const mockUpdateAbsolute = vi.fn().mockReturnValue({ eq: mockEqAbsolute });

    let jobListingsCallCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "seen_jobs") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{ job_listing_id: "seen-job-1" }],
              error: null,
            }),
          };
        }
        jobListingsCallCount++;
        return {
          update: jobListingsCallCount === 1 ? mockUpdateAbsolute : mockUpdateChain,
        };
      }),
    };
    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
    const result = await expireOldJobs();
    expect(result).toHaveProperty("expired");
    expect(typeof result.expired).toBe("number");
    expect(mockNotChain).toHaveBeenCalled();
  });

  it("throw si la requête absolute échoue", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ error: { message: "DB error" }, count: null }),
          }),
        }),
      }),
    };
    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
    await expect(expireOldJobs()).rejects.toThrow("Failed to expire old jobs");
  });
});
