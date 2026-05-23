# Score Refresh on CV Change — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Branch:** `feat/score-refresh-cv-change`

**Goal:** When a CV is re-analyzed (parsed_data updated), automatically re-score all active jobs that were previously scored with that resume so scores stay accurate.

**Architecture:** After `analyze-cv` persists new `parsed_data`, a fire-and-forget background call re-scores affected active jobs. We reuse existing `getJobIdsByResumeId` + `scoreJobsForProfile`. A new `getActiveJobsByIds` query fetches only active jobs to avoid wasting OpenAI tokens on expired ones. The Vercel 60s timeout means we cap re-scoring to 10 jobs max per call — the rest will be caught by the next cron cycle.

**Tech Stack:** Existing auto-scorer, existing score queries, no new dependencies

---

## Task 1: Add `getActiveJobsByIds` query

**Files:**
- Modify: `src/lib/supabase/queries/jobs.ts`

### Step 1: Write the implementation

Add after `getJobById`:

```typescript
/**
 * Fetch multiple active jobs by IDs. Returns only jobs where is_active=true.
 * Useful for re-scoring: filters out expired jobs to avoid wasting AI tokens.
 */
export async function getActiveJobsByIds(
  jobIds: string[]
): Promise<JobRow[]> {
  if (jobIds.length === 0) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("job_listings")
    .select("*")
    .in("id", jobIds)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to fetch active jobs by IDs: ${error.message}`);
  }

  return data ?? [];
}
```

### Step 2: Export from index

Add `getActiveJobsByIds` to `src/lib/supabase/queries/index.ts` exports.

### Step 3: Run type check

Run: `npx tsc --noEmit`

### Step 4: Commit

```bash
git add src/lib/supabase/queries/jobs.ts src/lib/supabase/queries/index.ts
git commit -m "feat(queries): add getActiveJobsByIds for batch active job lookup"
```

---

## Task 2: Add re-scoring logic to analyze-cv

**Files:**
- Modify: `src/app/api/ai/analyze-cv/route.ts`

### Step 1: Write the implementation

After the `updateResume` call (line 77-79) and before the return, add fire-and-forget re-scoring:

```typescript
// Fire-and-forget: re-score active jobs previously scored with this resume
if (resumeId) {
  refreshScoresForResume(user.id, resumeId).catch((err) => {
    console.error("[analyze-cv] Score refresh failed:", err instanceof Error ? err.message : err);
  });
}
```

Add the helper function at the bottom of the file (or as a separate import):

```typescript
import { getJobIdsByResumeId } from "@/lib/supabase/queries/scores";
import { getActiveJobsByIds } from "@/lib/supabase/queries";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";

const MAX_RESCORE_JOBS = 10;

async function refreshScoresForResume(userId: string, resumeId: string): Promise<void> {
  const jobIds = await getJobIdsByResumeId(userId, resumeId);
  if (jobIds.length === 0) return;

  const activeJobs = await getActiveJobsByIds(jobIds);
  if (activeJobs.length === 0) return;

  // Cap to avoid Vercel timeout (60s). Remaining jobs re-scored by next cron.
  const toRescore = activeJobs
    .slice(0, MAX_RESCORE_JOBS)
    .map((j) => ({ id: j.id, title: j.title, description: j.description }));

  console.log(`[analyze-cv] Re-scoring ${toRescore.length}/${activeJobs.length} active jobs for resume ${resumeId}`);

  await scoreJobsForProfile(userId, toRescore, resumeId);

  console.log(`[analyze-cv] Score refresh complete for resume ${resumeId}`);
}
```

**Key decisions:**
- Fire-and-forget: the user gets their analysis result immediately, re-scoring happens in the background of the same request
- MAX_RESCORE_JOBS = 10: safe within Vercel 60s timeout (analysis itself takes ~5-10s, each score ~2-3s)
- Remaining jobs (if > 10) get re-scored by the next cron fetch-jobs cycle since it uses the same resume
- Errors logged but don't fail the analyze-cv response

### Step 2: Run type check

Run: `npx tsc --noEmit`

### Step 3: Commit

```bash
git add src/app/api/ai/analyze-cv/route.ts
git commit -m "feat(analyze-cv): auto re-score active jobs when CV is re-analyzed"
```

---

## Task 3: Write tests

**Files:**
- Create: `src/app/api/ai/__tests__/analyze-cv-rescore.test.ts`

### Step 1: Write the tests

```typescript
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

import { getResumeById, getActiveJobsByIds } from "@/lib/supabase/queries";
import { getJobIdsByResumeId } from "@/lib/supabase/queries/scores";
import { scoreJobsForProfile } from "@/lib/services/auto-scorer";

describe("analyze-cv score refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Default: resume exists with raw_text
    vi.mocked(getResumeById).mockResolvedValue({
      id: "resume-1",
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

    const { POST } = await import("../../analyze-cv/route");
    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: "resume-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Wait for fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(getJobIdsByResumeId).toHaveBeenCalledWith("user-1", "resume-1");
    expect(getActiveJobsByIds).toHaveBeenCalledWith(["job-1", "job-2"]);
    expect(scoreJobsForProfile).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining([
        expect.objectContaining({ id: "job-1" }),
        expect.objectContaining({ id: "job-2" }),
      ]),
      "resume-1"
    );
  });

  it("does not trigger re-scoring when no jobs were previously scored", async () => {
    vi.mocked(getJobIdsByResumeId).mockResolvedValue([]);

    const { POST } = await import("../../analyze-cv/route");
    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: "resume-1" }),
    });

    await POST(req);
    await new Promise((r) => setTimeout(r, 50));

    expect(scoreJobsForProfile).not.toHaveBeenCalled();
  });

  it("does not trigger re-scoring for rawText mode (no resumeId)", async () => {
    const { POST } = await import("../../analyze-cv/route");
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

    const { POST } = await import("../../analyze-cv/route");
    const req = new Request("http://localhost/api/ai/analyze-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: "resume-1" }),
    });

    await POST(req);
    await new Promise((r) => setTimeout(r, 50));

    expect(vi.mocked(scoreJobsForProfile).mock.calls[0][1]).toHaveLength(10);
  });
});
```

### Step 2: Run tests

Run: `npx vitest run src/app/api/ai/__tests__/analyze-cv-rescore.test.ts`
Expected: All PASS

### Step 3: Commit

```bash
git add src/app/api/ai/__tests__/analyze-cv-rescore.test.ts
git commit -m "test(analyze-cv): add tests for automatic score refresh on CV re-analysis"
```

---

## Task 4: Verify full suite + update docs

### Step 1: Run full test suite

Run: `npx vitest run`
Expected: 0 new failures (pre-existing jobs-expiry fail is acceptable)

### Step 2: Update docs

In `docs/compact_current.md`: Mark "Score refresh apres changement CV" as done.
In `docs/BACKLOG.md`: Mark the item as resolved.

### Step 3: Commit

```bash
git add docs/compact_current.md docs/BACKLOG.md
git commit -m "docs: mark score-refresh-on-cv-change as implemented"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | getActiveJobsByIds query | `jobs.ts`, `index.ts` |
| 2 | Fire-and-forget re-scoring in analyze-cv | `analyze-cv/route.ts` |
| 3 | Tests (4 cases) | `__tests__/analyze-cv-rescore.test.ts` |
| 4 | Full suite verification + docs | `compact_current.md`, `BACKLOG.md` |

**Total: 4 tasks, 4 commits, 0 new endpoints, 1 new query, 1 modified route.**

**Design decisions:**
- Fire-and-forget (not blocking) : l'utilisateur recoit son resultat d'analyse immediatement
- Cap a 10 jobs : securite Vercel 60s timeout
- Jobs restants rescores par le cron suivant (meme resume_id utilise)
- Pas de nouvel endpoint : le re-scoring est une consequence naturelle de l'analyse
