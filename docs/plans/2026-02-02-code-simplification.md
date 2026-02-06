# Code Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce boilerplate and duplication across test mocks and AI routes without changing any behavior.

**Architecture:** Extract shared test utilities into a single helper file reused by all 5 query test suites. Extract AI route helpers (rate limit + JSON parse) into a shared module. Simplify `dismissJob` from 3 DB calls to 1 using native `.upsert()`.

**Tech Stack:** TypeScript, Vitest, Supabase JS v2, Next.js 16 API routes

---

## Lot A: Shared Test Mock Utility (biggest impact)

### Task 1: Create shared Supabase test mock utility

**Files:**
- Create: `src/test/supabase-mock.ts`

**Context:** Currently each test file (applications, resumes, scores, profiles, jobs) defines its own mock builders and repeats `mockClient as unknown as ReturnType<typeof getSupabase>` 80+ times across the codebase. The jobs test has the best generic pattern (`createChainBuilder`) - we generalize it.

**Step 1:** Create the shared utility file with these exports:

```typescript
// src/test/supabase-mock.ts
import { vi } from "vitest";
import type { getSupabase } from "@/lib/supabase/client";

// Re-export for convenience
export type SupabaseClient = ReturnType<typeof getSupabase>;

interface MockResponse {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Generic chainable mock builder.
 * All methods chain (return builder). Terminal methods resolve the promise.
 * The builder is also thenable for queries that end without .single().
 */
export function createChainBuilder(terminalResult: MockResponse) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "in", "or", "not", "gt", "gte", "lt", "lte",
    "order", "range", "limit", "ilike", "returns",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods resolve the promise
  builder.single = vi.fn().mockResolvedValue(terminalResult);
  builder.maybeSingle = vi.fn().mockResolvedValue(terminalResult);

  // Make builder thenable for queries without .single()
  builder.then = (resolve: (val: MockResponse) => void) =>
    Promise.resolve(terminalResult).then(resolve);

  return builder;
}

/**
 * Create a mock that supports two chained .eq() calls (e.g. delete with user_id filter).
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
 * Shortcut: cast a mock to SupabaseClient and set it on mockGetSupabase.
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
 * Returns a mock `from()` that cycles through configured responses.
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
```

**Step 2:** Run `npx vitest run` to ensure the new file doesn't break anything (it's not imported yet).

Expected: 135 tests pass (no change).

---

### Task 2: Migrate profiles.test.ts to shared mock utility

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/profiles.test.ts`
- Read: `src/test/supabase-mock.ts`

**Why profiles first:** Smallest test file (155 lines, 7 tests). Low risk migration to validate the approach.

**Step 1:** Replace the local `createMockClient` + all `as unknown as` casts:

Replace the local mock builder (lines 26-40) and all `mockGetSupabase.mockReturnValue(mockClient as unknown as ReturnType<typeof getSupabase>)` calls with imports from shared utility:

```typescript
import { createChainBuilder, useMock } from "@/test/supabase-mock";
```

Remove `createMockClient` function. For each test, replace:
```typescript
const mockClient = createMockClient({ data: ..., error: ... });
mockGetSupabase.mockReturnValue(mockClient as unknown as ReturnType<typeof getSupabase>);
```
With:
```typescript
const mockClient = createChainBuilder({ data: ..., error: ... });
useMock(mockGetSupabase, mockClient);
```

**Step 2:** Run `npx vitest run src/lib/supabase/queries/__tests__/profiles.test.ts`

Expected: 7 tests pass.

---

### Task 3: Migrate scores.test.ts to shared mock utility

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/scores.test.ts`

**Step 1:** Replace both local mock builders (`createSelectMockClient`, `createUpsertMockClient`) and all 14 `as unknown as` casts.

Import shared utilities:
```typescript
import { createChainBuilder, useMock } from "@/test/supabase-mock";
```

Remove `createSelectMockClient` and `createUpsertMockClient`. Replace all instances. The generic `createChainBuilder` already supports all methods (select, upsert, eq, in, single, maybeSingle).

**Step 2:** Run `npx vitest run src/lib/supabase/queries/__tests__/scores.test.ts`

Expected: 16 tests pass.

---

### Task 4: Migrate jobs.test.ts to shared mock utility

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/jobs.test.ts`

**Step 1:** The jobs test already has a good `createChainBuilder` - it's actually the template for our shared one. Replace the local version with the import:

```typescript
import { createChainBuilder, useMock, createMultiTableMock } from "@/test/supabase-mock";
```

Remove local `createChainBuilder` function (lines 34-62), remove `ChainableMethod` type (lines 15-27), remove `MockResponse` interface (lines 10-13).

Replace the `mockFrom`/`tableCallIndex`/`tableResponses` pattern with `createMultiTableMock` where tests use sequential table calls (dismissJob tests). For single-table tests, use `createChainBuilder` + `useMock`.

The `mockSupabase` mock and `vi.mock` setup stays the same since the jobs test uses a different mocking pattern (`vi.mock` returning a static object). The key change is importing `createChainBuilder` instead of defining it locally.

**Note:** The jobs test uses a module-level `vi.mock` with `mockFrom` pattern which is different from the other test files. Keep this pattern but import `createChainBuilder` from the shared utility.

**Step 2:** Run `npx vitest run src/lib/supabase/queries/__tests__/jobs.test.ts`

Expected: 26 tests pass.

---

### Task 5: Migrate resumes.test.ts to shared mock utility

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/resumes.test.ts`

**Step 1:** Replace `createMockClient` and `createUnsetMock` with shared imports:

```typescript
import { createChainBuilder, createDoubleEqBuilder, useMock, useMockOnce } from "@/test/supabase-mock";
```

Remove local `createMockClient` (lines 57-70) and `createUnsetMock` (lines 78-89).

Replace all `createMockClient(...)` with `createChainBuilder(...)`.
Replace all `createUnsetMock(...)` with `createDoubleEqBuilder(...)` (rename `chain` to `builder` in destructuring).
Replace all `as unknown as ReturnType<typeof getSupabase>` with `useMock(mockGetSupabase, ...)` or `useMockOnce(mockGetSupabase, ...)`.

For the `deleteResume` tests that create inline mocks (lines 449-454, 467-477, 490-494), replace with `createDoubleEqBuilder`.

**Step 2:** Run `npx vitest run src/lib/supabase/queries/__tests__/resumes.test.ts`

Expected: 17 tests pass.

---

### Task 6: Migrate applications.test.ts to shared mock utility

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/applications.test.ts`

**Step 1:** Replace all 4 local mock builders with shared imports:

```typescript
import { createChainBuilder, createDoubleEqBuilder, createMultiTableMock, useMock } from "@/test/supabase-mock";
```

Replace:
- `createListMockClient(result)` -> `createChainBuilder(result)` (the `returns` method is already in chainMethods)
- `createSingleMockClient(result)` -> `createChainBuilder(result)`
- `createDeleteMockClient(result)` -> `createDoubleEqBuilder(result)`
- `createStatsMockClient(config)` -> Keep a local simplified version OR use `createMultiTableMock`

For `createStatsMockClient`: The config object is complex (4 sub-chains with different terminal methods). Replace with `createMultiTableMock` and 4 separate `MockResponse` objects. The terminal methods differ (`.not()`, `.gt()`, `.gte()`, `.limit()`) but `createChainBuilder` already has all chain methods returning the builder, so they all resolve via `.then()`.

Replace all 25+ `mockGetSupabase.mockReturnValue(mockClient as unknown as ...)` with `useMock(mockGetSupabase, mockClient)`.

**Step 2:** Run `npx vitest run src/lib/supabase/queries/__tests__/applications.test.ts`

Expected: 32 tests pass.

---

### Task 7: Lot A verification + commit

**Step 1:** Run full test suite: `npx vitest run`

Expected: 135 tests pass.

**Step 2:** Run build: `npx next build`

Expected: 0 errors.

**Step 3:** Commit:
```bash
git add src/test/supabase-mock.ts src/lib/supabase/queries/__tests__/
git commit -m "refactor(tests): extract shared Supabase mock utility, eliminate 80+ type casts"
```

---

## Lot B: AI Route Helpers

### Task 8: Extract shared AI route helpers

**Files:**
- Create: `src/lib/api/ai-route-helpers.ts`

**Context:** The 3 AI routes (analyze-cv, match-score, cover-letter) all repeat the same rate-limit check (7 lines) and JSON parse error handling (6 lines). Extract into shared functions.

**Step 1:** Create the helper file:

```typescript
// src/lib/api/ai-route-helpers.ts
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limiter";

/**
 * Enforce AI rate limit for the given user.
 * Returns a 429 NextResponse if exceeded, or null if allowed.
 */
export function enforceAiRateLimit(userId: string): NextResponse | null {
  const limit = checkRateLimit(`ai:${userId}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }
  return null;
}

/**
 * Safely parse JSON from a request.
 * Returns { data } on success, or { error: NextResponse } on invalid JSON.
 */
export async function parseJsonBody(
  request: Request
): Promise<{ data: unknown; error?: undefined } | { data?: undefined; error: NextResponse }> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}

/**
 * Extract parsed CV data from a resume's parsed_data field.
 * Returns structured skills, experience, and summary.
 */
export function extractCvData(parsedData: Record<string, unknown>) {
  const skills = (parsedData.skills as {
    technical: string[];
    soft: string[];
    languages: string[];
  }) ?? { technical: [], soft: [], languages: [] };

  const experience =
    (parsedData.experience as {
      title: string;
      company: string;
      description: string;
    }[]) ?? [];

  const summary = (parsedData.summary as string) ?? "";

  return { skills, experience, summary };
}
```

**Step 2:** Run `npx vitest run` to verify nothing breaks (file not imported yet).

Expected: 135 tests pass.

---

### Task 9: Apply helpers to analyze-cv route

**Files:**
- Modify: `src/app/api/ai/analyze-cv/route.ts`

**Step 1:** Replace the rate-limit and JSON parse blocks:

```typescript
import { enforceAiRateLimit, parseJsonBody } from "@/lib/api/ai-route-helpers";
```

Remove `import { checkRateLimit } from "@/lib/api/rate-limiter";`.

Replace lines 19-32 (rate limit + JSON parse) with:
```typescript
    const rateLimited = enforceAiRateLimit(user.id);
    if (rateLimited) return rateLimited;

    const { data: raw, error: parseError } = await parseJsonBody(request);
    if (parseError) return parseError;
```

**Step 2:** Run `npx next build` to verify TypeScript compiles.

Expected: Build passes.

---

### Task 10: Apply helpers to match-score route

**Files:**
- Modify: `src/app/api/ai/match-score/route.ts`

**Step 1:** Same pattern. Import helpers, remove `checkRateLimit` import, replace the rate-limit + JSON parse blocks.

Additionally, replace the inline CV data extraction (lines 56-72) with:
```typescript
import { enforceAiRateLimit, parseJsonBody, extractCvData } from "@/lib/api/ai-route-helpers";
```

Replace lines 56-72 with:
```typescript
    const parsed = resume.parsed_data as Record<string, unknown>;
    const cvData = extractCvData(parsed);
```

And update the `scoreMatch` call to use `cvData` directly (it already has `skills`, `experience`, `summary`).

**Step 2:** Run `npx next build` to verify.

Expected: Build passes.

---

### Task 11: Apply helpers to cover-letter route

**Files:**
- Modify: `src/app/api/ai/cover-letter/route.ts`

**Step 1:** Import helpers, replace rate-limit + JSON parse blocks.

Replace CV data extraction (lines 64-75) with `extractCvData`.

Update the `options` construction to use `cvData.skills`, `cvData.experience`, `cvData.summary`:
```typescript
    const cvData = extractCvData(parsed);

    const options: GenerateOptions = {
      cvSummary: cvData.summary,
      cvSkills: [...cvData.skills.technical, ...cvData.skills.soft, ...cvData.skills.languages],
      cvExperience: cvData.experience
        .map((e) => `${e.title} at ${e.company}: ${e.description}`)
        .join("\n"),
      jobTitle: job.title,
      jobDescription: job.description,
      companyName: job.company_name ?? "Unknown Company",
      language: body.language,
      tone: body.tone,
    };
```

Remove `import { checkRateLimit } from "@/lib/api/rate-limiter";`.

**Step 2:** Run `npx next build` to verify.

Expected: Build passes.

---

### Task 12: Lot B verification + commit

**Step 1:** Run full test suite: `npx vitest run`

Expected: 135 tests pass.

**Step 2:** Run build: `npx next build`

Expected: 0 errors.

**Step 3:** Commit:
```bash
git add src/lib/api/ai-route-helpers.ts src/app/api/ai/
git commit -m "refactor(api): extract shared AI route helpers for rate-limit, JSON parse, CV data"
```

---

## Lot C: Simplify dismissJob

### Task 13: Simplify dismissJob to use native .upsert()

**Files:**
- Modify: `src/lib/supabase/queries/jobs.ts`

**Context:** `dismissJob()` currently does SELECT -> (INSERT or UPDATE) = 3 DB calls, 45 lines. The `seen_jobs` table has a UNIQUE constraint on `(user_id, job_listing_id)`, so native `.upsert()` with `onConflict` works directly. This mirrors the `upsertJobs` pattern already in the same file.

**Step 1:** Replace the entire `dismissJob` function body (lines 146-191) with:

```typescript
export async function dismissJob(userId: string, jobListingId: string): Promise<void> {
  if (!jobListingId) {
    throw new Error("jobListingId is required");
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from("seen_jobs")
    .upsert(
      { user_id: userId, job_listing_id: jobListingId, dismissed: true },
      { onConflict: "user_id,job_listing_id" }
    );

  if (error) {
    throw new Error(`Failed to dismiss job: ${error.message}`);
  }
}
```

Also remove the unused `SeenJobInsert` type import from line 7 if it's no longer used anywhere. Check first: `SeenJobInsert` is only used in `dismissJob`, so remove it.

**Step 2:** Run `npx next build` to verify TypeScript compiles.

Expected: Build passes.

---

### Task 14: Update dismissJob tests

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/jobs.test.ts`

**Context:** The current tests mock 2 sequential `seen_jobs` calls (SELECT + INSERT/UPDATE). With `.upsert()`, there's only 1 call. Simplify the tests accordingly.

**Step 1:** Replace the `dismissJob` describe block with simplified tests:

The new tests should verify:
1. Calls `.from("seen_jobs").upsert(record, { onConflict })` with correct data
2. Returns void on success
3. Throws when `jobListingId` is empty
4. Throws on upsert error

The mock setup simplifies to a single `tableResponses["seen_jobs"]` entry per test instead of 2.

Update tests to check that `.upsert` was called (instead of checking select+insert or select+update chains). The `createChainBuilder` already supports `.upsert()` in the chain methods.

**Step 2:** Run `npx vitest run src/lib/supabase/queries/__tests__/jobs.test.ts`

Expected: 26 tests pass (the 6 dismissJob tests might reduce to 4 since the SELECT+INSERT vs SELECT+UPDATE distinction no longer exists).

---

### Task 15: Lot C verification + commit

**Step 1:** Run full test suite: `npx vitest run`

Expected: All tests pass (count may decrease slightly if some dismiss tests are consolidated).

**Step 2:** Run build: `npx next build`

Expected: 0 errors.

**Step 3:** Commit:
```bash
git add src/lib/supabase/queries/jobs.ts src/lib/supabase/queries/__tests__/jobs.test.ts
git commit -m "refactor: simplify dismissJob from 3 DB calls to 1 using native upsert"
```

---

## Lot D: Final Verification

### Task 16: Full verification + hostile review

**Step 1:** Run `npx vitest run`

Expected: All tests pass.

**Step 2:** Run `npx next build`

Expected: 0 errors, 0 warnings.

**Step 3:** Hostile review checklist:
- [ ] No `as unknown as` in production code (except `parsed as unknown as Json` which is structural)
- [ ] No `as unknown as ReturnType<typeof getSupabase>` remaining in test files (replaced by `useMock`)
- [ ] All 135+ tests still pass
- [ ] No behavior changes - only internal refactoring
- [ ] No new dependencies added
- [ ] Shared utilities are well-typed

**Step 4:** Final commit if needed:
```bash
git commit -m "chore: code simplification complete - test mocks, AI helpers, dismissJob upsert"
```
