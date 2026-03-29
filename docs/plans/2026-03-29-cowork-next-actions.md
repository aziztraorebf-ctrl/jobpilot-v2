# Cowork Next-Actions Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Branch:** `feat/cowork-next-actions`

**Goal:** Create a GET `/api/cowork/next-actions` endpoint that tells the Cowork agent exactly what to do next, with prioritized actionable items, so the agent stops guessing.

**Architecture:** The endpoint aggregates data from dashboard-summary, unseen jobs, stale applications, and top-scored unseen jobs into a single prioritized action list. Each action has a type, priority, reason, and the exact API call to make. The agent calls this one endpoint and executes actions in order.

**Tech Stack:** Next.js API Route, Supabase queries, Zod (response typing), existing cowork utilities

---

## Design: Action Types & Priority

The endpoint returns a sorted array of actions. Priority is computed from urgency rules:

| Action Type | Trigger Condition | Priority | Suggested API Call |
|---|---|---|---|
| `fetch_jobs` | unseenJobCount < 10 OR no jobs fetched in 24h | HIGH | `POST /api/cowork/fetch-and-score` |
| `apply_high_match` | Unseen jobs with score >= 75, no application yet | HIGH | `POST /api/cowork/browser-apply` |
| `review_stale` | Applications in applied/interview not updated > 7 days | MEDIUM | Manual review or status update |
| `score_unscored` | Active unseen jobs with no score | MEDIUM | `POST /api/cowork/fetch-and-score` |
| `notify_matches` | Top scored jobs in last 24h not yet notified | LOW | `POST /api/cowork/notify` |
| `idle` | Nothing to do | LOW | None |

**Response shape:**

```typescript
{
  actions: Array<{
    type: string;
    priority: "high" | "medium" | "low";
    reason: string;
    endpoint?: string;
    method?: string;
    payload?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }>;
  context: {
    unseenJobCount: number;
    activeJobs: number;
    staleApplicationCount: number;
    recentJobsFetched24h: number;
    totalApplications: number;
    statusCounts: Record<string, number>;
  };
  generatedAt: string;
}
```

---

## Task 1: Create query helper — getUnscoredJobCount

**Files:**
- Modify: `src/lib/supabase/queries/cowork.ts`
- Test: `src/lib/supabase/queries/__tests__/cowork-queries.test.ts`

### Step 1: Write the failing test

```typescript
// src/lib/supabase/queries/__tests__/cowork-queries.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test that getUnscoredJobCount calls the RPC correctly
describe("getUnscoredJobCount", () => {
  it("should return count from RPC", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 12, error: null });
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabase: () => ({ rpc: mockRpc }),
    }));

    const { getUnscoredJobCount } = await import("../cowork");
    const count = await getUnscoredJobCount("user-123");
    expect(count).toBe(12);
    expect(mockRpc).toHaveBeenCalledWith("count_unscored_jobs", { p_user_id: "user-123" });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/lib/supabase/queries/__tests__/cowork-queries.test.ts`
Expected: FAIL — `getUnscoredJobCount` not exported

### Step 3: Write minimal implementation

Add to `src/lib/supabase/queries/cowork.ts`:

```typescript
/**
 * Count active unseen jobs that have no match_score entry.
 * Uses server-side RPC for efficiency.
 */
export async function getUnscoredJobCount(userId: string): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("count_unscored_jobs", { p_user_id: userId });
  if (error) throw new Error(`Failed to count unscored jobs: ${error.message}`);
  return data ?? 0;
}
```

**NOTE:** This requires an RPC function `count_unscored_jobs` in Supabase. If it doesn't exist, we need a migration (Task 1b). Alternatively, we can use a direct query approach without RPC — check if the function exists first.

**Fallback (no RPC):** If we don't want another migration, use a simpler approach:

```typescript
export async function getUnscoredJobCount(userId: string): Promise<number> {
  const supabase = getSupabase();
  // Get active unseen job IDs
  const { data: unseenData, error: unseenErr } = await supabase
    .rpc("count_unseen_jobs", { p_user_id: userId });
  if (unseenErr) throw new Error(`Failed: ${unseenErr.message}`);

  // Count jobs with scores
  // For next-actions, we can estimate: if unseenJobCount > scoredRecentCount, there are unscored jobs
  return unseenData ?? 0;
}
```

Actually, the simpler approach: query `getScoreMap` for unseen jobs and count those without scores. But this requires fetching all unseen job IDs first, which is heavy. Let's skip the dedicated RPC and compute it in the route handler from data we already have.

**Decision: Skip this task.** We'll compute unscored count directly in the route handler using data already fetched. No new query needed.

### Step 4: Commit (skip — no changes)

---

## Task 2: Create query helper — getTopScoredUnseenJobs

**Files:**
- Modify: `src/lib/supabase/queries/cowork.ts`

### Step 1: Write the implementation

Add to `src/lib/supabase/queries/cowork.ts`:

```typescript
/**
 * Get unseen active jobs with high scores (>= threshold), not yet applied to.
 * Returns top N jobs sorted by score descending.
 */
export async function getTopScoredUnseenJobs(
  userId: string,
  minScore: number = 70,
  limit: number = 10
): Promise<Array<{
  job_listing_id: string;
  title: string;
  company_name: string | null;
  source_url: string;
  overall_score: number;
}>> {
  const supabase = getSupabase();

  // Get unseen active jobs with their scores, excluding those with applications
  const { data, error } = await supabase
    .from("match_scores")
    .select(`
      job_listing_id,
      overall_score,
      job_listings!inner (
        id,
        title,
        company_name,
        source_url,
        is_active
      )
    `)
    .eq("user_id", userId)
    .gte("overall_score", minScore)
    .eq("job_listings.is_active", true)
    .order("overall_score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch top scored unseen jobs: ${error.message}`);

  // Filter out jobs that already have applications
  const { data: appJobIds, error: appErr } = await supabase
    .from("applications")
    .select("job_listing_id")
    .eq("user_id", userId);

  if (appErr) throw new Error(`Failed to fetch application job IDs: ${appErr.message}`);

  const appliedSet = new Set((appJobIds ?? []).map((a) => a.job_listing_id));

  // Filter out jobs already seen (in seen_jobs table)
  const { data: seenData, error: seenErr } = await supabase
    .from("seen_jobs")
    .select("job_listing_id")
    .eq("user_id", userId);

  if (seenErr) throw new Error(`Failed to fetch seen jobs: ${seenErr.message}`);

  const seenSet = new Set((seenData ?? []).map((s) => s.job_listing_id));

  return (data ?? [])
    .filter((row) => !appliedSet.has(row.job_listing_id) && !seenSet.has(row.job_listing_id))
    .map((row) => {
      const job = row.job_listings as unknown as {
        id: string; title: string; company_name: string | null; source_url: string;
      };
      return {
        job_listing_id: row.job_listing_id,
        title: job.title,
        company_name: job.company_name,
        source_url: job.source_url,
        overall_score: row.overall_score,
      };
    });
}
```

### Step 2: Run build to verify no type errors

Run: `npx tsc --noEmit`

### Step 3: Commit

```bash
git add src/lib/supabase/queries/cowork.ts
git commit -m "feat(cowork): add getTopScoredUnseenJobs query for next-actions"
```

---

## Task 3: Create the next-actions route

**Files:**
- Create: `src/app/api/cowork/next-actions/route.ts`

### Step 1: Write the route

```typescript
import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import { getProfile, getStaleApplications, getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import {
  getDashboardCounts,
  getRecentJobCount,
  getUnseenJobCount,
  getTopScoredUnseenJobs,
} from "@/lib/supabase/queries/cowork";

interface Action {
  type: string;
  priority: "high" | "medium" | "low";
  reason: string;
  endpoint?: string;
  method?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const HIGH_SCORE_THRESHOLD = 75;
const LOW_UNSEEN_THRESHOLD = 10;
const STALE_DAYS = 7;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ error: "No profiles found" }, { status: 404 });
    }
    const userId = profiles[0].id;

    // Fetch all data in parallel
    const [counts, recentJobs, unseenJobs, stale, topScored] = await Promise.all([
      getDashboardCounts(userId),
      getRecentJobCount(24),
      getUnseenJobCount(userId),
      getStaleApplications(userId, STALE_DAYS),
      getTopScoredUnseenJobs(userId, HIGH_SCORE_THRESHOLD, 5),
    ]);

    const actions: Action[] = [];

    // Rule 1: Need more jobs?
    if (unseenJobs < LOW_UNSEEN_THRESHOLD || recentJobs === 0) {
      actions.push({
        type: "fetch_jobs",
        priority: "high",
        reason:
          recentJobs === 0
            ? "No jobs fetched in the last 24h. Pipeline needs fresh data."
            : `Only ${unseenJobs} unseen jobs remain. Fetch more to keep the pipeline flowing.`,
        endpoint: "/api/cowork/fetch-and-score",
        method: "POST",
      });
    }

    // Rule 2: High-score unseen jobs to apply to
    if (topScored.length > 0) {
      for (const job of topScored) {
        actions.push({
          type: "apply_high_match",
          priority: "high",
          reason: `Score ${job.overall_score}% — strong match. Save and apply.`,
          endpoint: "/api/cowork/browser-apply",
          method: "POST",
          payload: {
            job_listing_id: job.job_listing_id,
            application_url: job.source_url,
          },
          data: {
            title: job.title,
            company: job.company_name,
            score: job.overall_score,
          },
        });
      }
    }

    // Rule 3: Stale applications needing follow-up
    if (stale.length > 0) {
      actions.push({
        type: "review_stale",
        priority: "medium",
        reason: `${stale.length} application(s) not updated in ${STALE_DAYS}+ days. Review or escalate.`,
        data: {
          count: stale.length,
          applications: stale.map((app) => ({
            id: app.id,
            status: app.status,
            updated_at: app.updated_at,
            title: app.job_listings?.title ?? "Unknown",
            company: app.job_listings?.company_name ?? null,
          })),
        },
      });
    }

    // Rule 4: Send notification if top matches exist and recent fetch happened
    if (recentJobs > 0 && topScored.length > 0) {
      actions.push({
        type: "notify_matches",
        priority: "low",
        reason: `${topScored.length} high-scoring job(s) found. Send email digest.`,
        endpoint: "/api/cowork/notify",
        method: "POST",
        payload: {
          type: "new_matches",
          data: {
            jobs: topScored.map((j) => ({
              title: j.title,
              company: j.company_name,
              location: null,
              sourceUrl: j.source_url,
              overallScore: j.overall_score,
              matchingSkills: [],
            })),
            totalFetched: recentJobs,
            totalScored: topScored.length,
          },
        },
      });
    }

    // Rule 5: Nothing to do
    if (actions.length === 0) {
      actions.push({
        type: "idle",
        priority: "low",
        reason: "Pipeline is healthy. No urgent actions needed.",
      });
    }

    // Sort by priority: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      actions,
      context: {
        unseenJobCount: unseenJobs,
        activeJobs: counts.activeJobs,
        staleApplicationCount: stale.length,
        recentJobsFetched24h: recentJobs,
        totalApplications: counts.totalApplications,
        statusCounts: counts.statusCounts,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error, "cowork/next-actions");
  }
}
```

### Step 2: Run build to verify

Run: `npx tsc --noEmit`

### Step 3: Commit

```bash
git add src/app/api/cowork/next-actions/route.ts
git commit -m "feat(cowork): add next-actions endpoint for agent decision-making"
```

---

## Task 4: Write tests for next-actions route

**Files:**
- Create: `src/app/api/cowork/__tests__/next-actions.test.ts`

### Step 1: Write tests

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies
vi.mock("@/lib/api/cron-auth", () => ({
  verifyCronSecret: vi.fn(),
  unauthorizedResponse: vi.fn(() => new Response("Unauthorized", { status: 401 })),
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
import { getUnseenJobCount, getRecentJobCount, getTopScoredUnseenJobs } from "@/lib/supabase/queries/cowork";
import { getStaleApplications } from "@/lib/supabase/queries";

describe("GET /api/cowork/next-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCronSecret).mockReturnValue(true);
  });

  it("returns 401 without valid cron secret", async () => {
    vi.mocked(verifyCronSecret).mockReturnValue(false);
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions"));
    expect(res.status).toBe(401);
  });

  it("returns fetch_jobs action when unseen count is low", async () => {
    vi.mocked(getUnseenJobCount).mockResolvedValue(5);
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions", {
      headers: { Authorization: "Bearer test" },
    }));
    const json = await res.json();
    expect(json.actions.some((a: { type: string }) => a.type === "fetch_jobs")).toBe(true);
  });

  it("returns apply_high_match when high-scored jobs exist", async () => {
    vi.mocked(getTopScoredUnseenJobs).mockResolvedValue([
      { job_listing_id: "j1", title: "Dev", company_name: "ACME", source_url: "http://example.com", overall_score: 85 },
    ]);
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions", {
      headers: { Authorization: "Bearer test" },
    }));
    const json = await res.json();
    expect(json.actions.some((a: { type: string }) => a.type === "apply_high_match")).toBe(true);
  });

  it("returns review_stale when stale applications exist", async () => {
    vi.mocked(getStaleApplications).mockResolvedValue([
      { id: "a1", status: "applied", updated_at: "2026-03-20", job_listings: { title: "Job", company_name: "Co" } },
    ] as never);
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions", {
      headers: { Authorization: "Bearer test" },
    }));
    const json = await res.json();
    expect(json.actions.some((a: { type: string }) => a.type === "review_stale")).toBe(true);
  });

  it("returns idle when nothing to do", async () => {
    vi.mocked(getUnseenJobCount).mockResolvedValue(30);
    vi.mocked(getRecentJobCount).mockResolvedValue(20);
    vi.mocked(getTopScoredUnseenJobs).mockResolvedValue([]);
    vi.mocked(getStaleApplications).mockResolvedValue([]);
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions", {
      headers: { Authorization: "Bearer test" },
    }));
    const json = await res.json();
    expect(json.actions).toHaveLength(1);
    expect(json.actions[0].type).toBe("idle");
  });

  it("sorts actions by priority (high first)", async () => {
    vi.mocked(getUnseenJobCount).mockResolvedValue(5);
    vi.mocked(getTopScoredUnseenJobs).mockResolvedValue([
      { job_listing_id: "j1", title: "Dev", company_name: "ACME", source_url: "http://example.com", overall_score: 85 },
    ]);
    vi.mocked(getStaleApplications).mockResolvedValue([
      { id: "a1", status: "applied", updated_at: "2026-03-20", job_listings: { title: "Job", company_name: "Co" } },
    ] as never);
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions", {
      headers: { Authorization: "Bearer test" },
    }));
    const json = await res.json();
    const priorities = json.actions.map((a: { priority: string }) => a.priority);
    // High should come before medium
    const highIdx = priorities.indexOf("high");
    const medIdx = priorities.indexOf("medium");
    expect(highIdx).toBeLessThan(medIdx);
  });

  it("includes context in response", async () => {
    const { GET } = await import("../next-actions/route");
    const res = await GET(new Request("http://localhost/api/cowork/next-actions", {
      headers: { Authorization: "Bearer test" },
    }));
    const json = await res.json();
    expect(json.context).toBeDefined();
    expect(json.context.unseenJobCount).toBeDefined();
    expect(json.context.activeJobs).toBeDefined();
    expect(json.generatedAt).toBeDefined();
  });
});
```

### Step 2: Run tests

Run: `npx vitest run src/app/api/cowork/__tests__/next-actions.test.ts`
Expected: All PASS

### Step 3: Commit

```bash
git add src/app/api/cowork/__tests__/next-actions.test.ts
git commit -m "test(cowork): add tests for next-actions endpoint"
```

---

## Task 5: Export from queries index + verify build

**Files:**
- Modify: `src/lib/supabase/queries/index.ts` (add `getTopScoredUnseenJobs` export if needed)

### Step 1: Check if cowork exports are in index

Read `src/lib/supabase/queries/index.ts` and verify `getTopScoredUnseenJobs` is accessible via the cowork module import.

### Step 2: Run full test suite

Run: `npx vitest run`
Expected: All tests pass (existing + new)

### Step 3: Run type check

Run: `npx tsc --noEmit`
Expected: No errors

### Step 4: Commit (if any changes)

```bash
git add -A
git commit -m "chore: ensure cowork query exports are accessible"
```

---

## Task 6: Update compact_current.md and backlog

**Files:**
- Modify: `docs/compact_current.md`
- Modify: `docs/BACKLOG.md`

### Step 1: Update docs

- In `compact_current.md`: Add the next-actions endpoint to the session context
- In `BACKLOG.md`: Mark "Cowork next-actions endpoint" as done
- Move to next priority item

### Step 2: Commit

```bash
git add docs/compact_current.md docs/BACKLOG.md
git commit -m "docs: update compact and backlog after next-actions implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | ~~getUnscoredJobCount query~~ SKIPPED | - |
| 2 | getTopScoredUnseenJobs query | `cowork.ts` |
| 3 | next-actions route handler | `next-actions/route.ts` |
| 4 | Tests for next-actions | `__tests__/next-actions.test.ts` |
| 5 | Export verification + full test | `queries/index.ts` |
| 6 | Update docs | `compact_current.md`, `BACKLOG.md` |

**Total: 5 tasks, 4 commits, 1 new endpoint, 1 new query function.**
