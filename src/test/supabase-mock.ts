import { vi } from "vitest";
import type { getSupabase } from "@/lib/supabase/client";

export type SupabaseClient = ReturnType<typeof getSupabase>;

export interface MockResponse {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

/**
 * Generic chainable mock builder.
 * All methods chain (return builder). Terminal methods resolve the promise.
 * The builder is also thenable for queries that end without .single().
 */
export function createChainBuilder(terminalResult: MockResponse) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "from", "select", "insert", "upsert", "update", "delete",
    "eq", "in", "or", "not", "gt", "gte", "lt", "lte",
    "order", "range", "limit", "ilike", "returns",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.single = vi.fn().mockResolvedValue(terminalResult);
  builder.maybeSingle = vi.fn().mockResolvedValue(terminalResult);

  builder.then = (resolve: (val: MockResponse) => void) =>
    Promise.resolve(terminalResult).then(resolve);

  return builder;
}

/**
 * Create a mock that supports two chained .eq() calls
 * (e.g. delete with user_id filter, or unsetAllPrimaries).
 * First .eq() returns an object with .eq() that resolves the promise.
 */
export function createDoubleEqBuilder(terminalResult: MockResponse) {
  const innerEq = { eq: vi.fn().mockResolvedValue(terminalResult) };
  const builder: Record<string, unknown> = {};

  const chainMethods = ["from", "select", "insert", "update", "delete"];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.eq = vi.fn().mockReturnValue(innerEq);

  return { builder, innerEq };
}

/**
 * Cast a mock to SupabaseClient and set it on mockGetSupabase.
 * Eliminates the `as unknown as ReturnType<typeof getSupabase>` repetition.
 */
export function useMock(
  mockGetSupabase: ReturnType<typeof vi.mocked<typeof getSupabase>>,
  mock: Record<string, unknown>
) {
  mockGetSupabase.mockReturnValue(mock as unknown as SupabaseClient);
}

/**
 * Same as useMock but for mockReturnValueOnce (sequential calls).
 */
export function useMockOnce(
  mockGetSupabase: ReturnType<typeof vi.mocked<typeof getSupabase>>,
  mock: Record<string, unknown>
) {
  mockGetSupabase.mockReturnValueOnce(mock as unknown as SupabaseClient);
}

/**
 * Track per-table responses for multi-table queries (like getApplicationStats).
 * Returns a mock with `from()` that cycles through configured responses.
 */
export function createMultiTableMock(tableResponses: MockResponse[]) {
  let callIndex = 0;
  const chains = tableResponses.map((response) => createChainBuilder(response));

  return {
    from: vi.fn().mockImplementation(() => {
      const chain = chains[callIndex];
      callIndex++;
      return chain;
    }),
    chains,
  };
}
