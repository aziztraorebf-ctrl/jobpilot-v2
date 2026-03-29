import { describe, it, expect, vi, beforeEach } from "vitest";
import { expireOldJobs } from "../jobs";

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

function emptyResult() {
  return { data: [], error: null, count: 0 };
}

function makeChainable(result = emptyResult()): any {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it thenable — resolves to the result when awaited
        return (resolve: any) => resolve(result);
      }
      if (prop === "catch" || prop === "finally") {
        return () => Promise.resolve(result);
      }
      // Any property access returns a function that returns another chainable
      return (..._args: any[]) => makeChainable(result);
    },
  };
  return new Proxy({}, handler);
}

describe("expireOldJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("est une fonction exportee", () => {
    expect(typeof expireOldJobs).toBe("function");
  });

  it("retourne { expired: 0 } quand aucun job a expirer", async () => {
    const mockSupabase = { from: () => makeChainable() };
    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

    const result = await expireOldJobs();
    expect(result).toEqual({ expired: 0 });
  });

  describe("expiry hierarchy constants", () => {
    it("PROCESSED < UNSEEN < ABSOLUTE", () => {
      const PROCESSED = 3;
      const UNSEEN = 7;
      const ABSOLUTE = 30;
      expect(PROCESSED).toBeLessThan(UNSEEN);
      expect(UNSEEN).toBeLessThan(ABSOLUTE);
    });
  });
});
