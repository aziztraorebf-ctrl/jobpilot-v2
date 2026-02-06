# Phase 5: Supabase Integration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all mock data with real Supabase queries via server-side data access layer + API routes, making the app functional with a real database.

**Architecture:** Server-side data access layer (`src/lib/supabase/queries/`) that wraps Supabase client calls with typed helpers. API routes (`src/app/api/`) expose mutations. Pages fetch data server-side via these queries and pass to client components as props. Single-user app (no RLS, service_role key, auth via password middleware).

**Tech Stack:** Supabase JS v2, Next.js 16 App Router (server components + API routes), Zod validation, Vitest tests

**Profile UUID:** `126d2d02-c032-49b0-a2c8-8a7034b6512f` (single user in DB)

---

## Pre-requisite: DB Schema Fix

The `job_listings.source` CHECK constraint only allows `('jooble', 'adzuna', 'manual')` but our app uses `jsearch`. Must fix before inserting any JSearch jobs.

Also, `api_usage.api_name` CHECK only allows `('openai', 'jooble', 'adzuna')` - needs `jsearch`.

---

### Task 0: Fix DB Schema - Add jsearch to CHECK constraints

**Files:**
- Create: `supabase/migrations/002_add_jsearch_source.sql`

**Step 1: Write the migration SQL**

```sql
-- Add 'jsearch' to job_listings.source CHECK constraint
ALTER TABLE public.job_listings DROP CONSTRAINT IF EXISTS job_listings_source_check;
ALTER TABLE public.job_listings ADD CONSTRAINT job_listings_source_check
  CHECK (source IN ('jooble', 'adzuna', 'jsearch', 'manual'));

-- Add 'jsearch' to api_usage.api_name CHECK constraint
ALTER TABLE public.api_usage DROP CONSTRAINT IF EXISTS api_usage_api_name_check;
ALTER TABLE public.api_usage ADD CONSTRAINT api_usage_api_name_check
  CHECK (api_name IN ('openai', 'jooble', 'adzuna', 'jsearch'));
```

**Step 2: Apply migration via Supabase MCP**

Run via `mcp__supabase__apply_migration`.

**Step 3: Update TypeScript types**

In `src/types/database.ts`:
- `job_listings.Row.source`: add `"jsearch"` to union type
- `api_usage.Row.api_name`: add `"jsearch"` to union type

**Step 4: Commit**

```bash
git add supabase/migrations/002_add_jsearch_source.sql src/types/database.ts
git commit -m "fix: add jsearch to DB CHECK constraints"
```

---

### Task 1: Create Supabase Query Layer - Profiles

**Files:**
- Create: `src/lib/supabase/queries/profiles.ts`
- Create: `src/lib/supabase/queries/__tests__/profiles.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/supabase/queries/__tests__/profiles.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

import { getProfile, updateProfile } from "../profiles";

describe("profiles queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("getProfile returns profile data", async () => {
    const profile = { id: "abc", full_name: "Aziz", email: "a@b.com" };
    mockSingle.mockResolvedValue({ data: profile, error: null });

    const result = await getProfile("abc");
    expect(result).toEqual(profile);
    expect(mockFrom).toHaveBeenCalledWith("profiles");
  });

  it("getProfile throws on error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(getProfile("abc")).rejects.toThrow("not found");
  });

  it("updateProfile updates and returns profile", async () => {
    const updated = { id: "abc", full_name: "New Name" };
    mockSingle.mockResolvedValue({ data: updated, error: null });

    const result = await updateProfile("abc", { full_name: "New Name" });
    expect(result).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith({ full_name: "New Name" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase/queries/__tests__/profiles.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```typescript
// src/lib/supabase/queries/profiles.ts
import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function getProfile(userId: string): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/supabase/queries/__tests__/profiles.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/supabase/queries/profiles.ts src/lib/supabase/queries/__tests__/profiles.test.ts
git commit -m "feat: add Supabase query layer for profiles"
```

---

### Task 2: Create Supabase Query Layer - Job Listings

**Files:**
- Create: `src/lib/supabase/queries/jobs.ts`
- Create: `src/lib/supabase/queries/__tests__/jobs.test.ts`

**Step 1: Write the failing test**

Test cases:
- `upsertJobs` - bulk insert with dedup (ON CONFLICT dedup_hash DO UPDATE)
- `getJobs` - fetch with filters (source, remote, minScore, search text)
- `getJobById` - single job by ID
- `dismissJob` - insert into seen_jobs with dismissed=true
- `getSeenJobIds` - return list of seen/dismissed job_listing_ids

**Step 2: Run test to verify it fails**

**Step 3: Write implementation**

```typescript
// src/lib/supabase/queries/jobs.ts
import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { UnifiedJob } from "@/lib/schemas/job";

type JobRow = Database["public"]["Tables"]["job_listings"]["Row"];
type SeenJobInsert = Database["public"]["Tables"]["seen_jobs"]["Insert"];

const USER_ID = "126d2d02-c032-49b0-a2c8-8a7034b6512f";

export async function upsertJobs(jobs: UnifiedJob[]): Promise<JobRow[]> {
  const supabase = getSupabase();
  const rows = jobs.map((j) => ({
    source: j.source,
    source_id: j.source_id,
    source_url: j.source_url,
    dedup_hash: j.dedup_hash,
    title: j.title,
    company_name: j.company_name,
    location: j.location,
    location_lat: j.location_lat,
    location_lng: j.location_lng,
    description: j.description,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    salary_currency: j.salary_currency,
    salary_is_predicted: j.salary_is_predicted,
    job_type: j.job_type,
    category: j.category,
    contract_type: j.contract_type,
    remote_type: j.remote_type,
    posted_at: j.posted_at,
    raw_data: j.raw_data as Record<string, unknown>,
  }));

  const { data, error } = await supabase
    .from("job_listings")
    .upsert(rows, { onConflict: "dedup_hash" })
    .select();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface JobFilters {
  search?: string;
  source?: string;
  remoteType?: string;
  limit?: number;
  offset?: number;
}

export async function getJobs(filters: JobFilters = {}): Promise<JobRow[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("job_listings")
    .select("*")
    .eq("is_active", true)
    .order("fetched_at", { ascending: false });

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.remoteType && filters.remoteType !== "all") {
    query = query.eq("remote_type", filters.remoteType);
  }
  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`
    );
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getJobById(jobId: string): Promise<JobRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("job_listings")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function dismissJob(jobListingId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("seen_jobs")
    .upsert(
      { user_id: USER_ID, job_listing_id: jobListingId, dismissed: true },
      { onConflict: "user_id,job_listing_id" }
    );

  if (error) throw new Error(error.message);
}

export async function getDismissedJobIds(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("seen_jobs")
    .select("job_listing_id")
    .eq("user_id", USER_ID)
    .eq("dismissed", true);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.job_listing_id);
}
```

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add src/lib/supabase/queries/jobs.ts src/lib/supabase/queries/__tests__/jobs.test.ts
git commit -m "feat: add Supabase query layer for job listings"
```

---

### Task 3: Create Supabase Query Layer - Applications

**Files:**
- Create: `src/lib/supabase/queries/applications.ts`
- Create: `src/lib/supabase/queries/__tests__/applications.test.ts`

**Step 1: Write tests for:**
- `getApplications()` - fetch all with joined job_listing data
- `getApplicationById(id)` - single with job data
- `createApplication(jobListingId)` - insert with status='saved'
- `updateApplicationStatus(id, newStatus)` - update status + set timestamp fields
- `deleteApplication(id)` - delete
- `getApplicationStats()` - count by status + upcoming interviews

**Step 2: Write implementation**

Key design decisions:
- Join `job_listings` via `job_listing_id` for display data (title, company)
- When status changes to `applied`, set `applied_at = now()`
- When status changes to `interview`, set `interview_at` (user provides date)
- When status changes to `offer`, set `offer_at = now()`
- When status changes to terminal (`rejected`/`accepted`/`withdrawn`), set `closed_at = now()`
- `getApplicationStats()` returns `{ totalActive, byStatus, upcomingInterviews }`

**Step 3: Commit**

```bash
git add src/lib/supabase/queries/applications.ts src/lib/supabase/queries/__tests__/applications.test.ts
git commit -m "feat: add Supabase query layer for applications"
```

---

### Task 4: Create Supabase Query Layer - Match Scores

**Files:**
- Create: `src/lib/supabase/queries/scores.ts`
- Create: `src/lib/supabase/queries/__tests__/scores.test.ts`

**Step 1: Write tests for:**
- `getScoresForJobs(jobIds[])` - fetch scores for a list of jobs
- `getScoreMap(jobIds[])` - returns `Record<jobListingId, overallScore>`
- `upsertScore(score)` - insert/update match score
- `getScoreForJob(jobId, resumeId)` - check if score already exists (cache)

**Step 2: Write implementation**

```typescript
// Key: getScoreMap returns { [job_listing_id]: overall_score }
// Used by job list and dashboard to display scores alongside jobs
export async function getScoreMap(jobIds: string[]): Promise<Record<string, number>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("match_scores")
    .select("job_listing_id, overall_score")
    .eq("user_id", USER_ID)
    .in("job_listing_id", jobIds);

  if (error) throw new Error(error.message);
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[row.job_listing_id] = row.overall_score;
  }
  return map;
}
```

**Step 3: Commit**

```bash
git add src/lib/supabase/queries/scores.ts src/lib/supabase/queries/__tests__/scores.test.ts
git commit -m "feat: add Supabase query layer for match scores"
```

---

### Task 5: Create Supabase Query Layer - Resumes

**Files:**
- Create: `src/lib/supabase/queries/resumes.ts`
- Create: `src/lib/supabase/queries/__tests__/resumes.test.ts`

**Step 1: Write tests for:**
- `getPrimaryResume()` - fetch the primary resume for the user
- `getResumes()` - list all resumes
- `createResume(data)` - insert new resume record
- `updateResume(id, data)` - update parsed_data or is_primary
- `deleteResume(id)` - delete

**Step 2: Write implementation**

Note: Actual file upload to Supabase Storage is NOT part of this task. This task handles the `resumes` table metadata. File upload will be a separate concern in the CV Upload component rework.

**Step 3: Commit**

```bash
git add src/lib/supabase/queries/resumes.ts src/lib/supabase/queries/__tests__/resumes.test.ts
git commit -m "feat: add Supabase query layer for resumes"
```

---

### Task 6: Create Query Layer Index + Constants

**Files:**
- Create: `src/lib/supabase/queries/index.ts`
- Create: `src/lib/supabase/constants.ts`

**Step 1: Create constants file**

```typescript
// src/lib/supabase/constants.ts
// Single-user app: hardcoded profile UUID
// This will be replaced by Supabase Auth in Phase 6
export const USER_ID = "126d2d02-c032-49b0-a2c8-8a7034b6512f";
```

**Step 2: Create barrel export**

```typescript
// src/lib/supabase/queries/index.ts
export { getProfile, updateProfile } from "./profiles";
export { upsertJobs, getJobs, getJobById, dismissJob, getDismissedJobIds } from "./jobs";
export type { JobFilters } from "./jobs";
export { getApplications, getApplicationById, createApplication, updateApplicationStatus, deleteApplication, getApplicationStats } from "./applications";
export { getScoreMap, getScoresForJobs, upsertScore, getScoreForJob } from "./scores";
export { getPrimaryResume, getResumes, createResume, updateResume, deleteResume } from "./resumes";
```

**Step 3: Refactor all query files to import USER_ID from constants instead of hardcoding**

**Step 4: Commit**

```bash
git add src/lib/supabase/constants.ts src/lib/supabase/queries/index.ts src/lib/supabase/queries/*.ts
git commit -m "feat: add query layer index + centralize USER_ID constant"
```

---

### Task 7: Create API Routes - Jobs

**Files:**
- Create: `src/app/api/jobs/search/route.ts`
- Create: `src/app/api/jobs/dismiss/route.ts`

**Step 1: Write `/api/jobs/search` POST route**

Accepts: `{ query, page?, sources?, remoteOnly?, country? }`

Flow:
1. Call `aggregateJobs()` from job-aggregator service
2. Call `upsertJobs()` to store in DB
3. Return stored jobs from DB (with UUIDs assigned)

```typescript
// src/app/api/jobs/search/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { aggregateJobs } from "@/lib/services/job-aggregator";
import { upsertJobs, getJobs } from "@/lib/supabase/queries";

const SearchRequestSchema = z.object({
  query: z.string().min(1),
  page: z.number().int().positive().default(1),
  country: z.string().default("ca"),
  remoteOnly: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const params = SearchRequestSchema.parse(body);

    const results = await aggregateJobs({
      keywords: params.query,
      location: params.country === "ca" ? "Canada" : params.country,
      page: params.page,
      remoteOnly: params.remoteOnly,
    });

    // Persist to DB
    await upsertJobs(results.jobs);

    // Return jobs from DB (with UUIDs)
    const jobs = await getJobs({ limit: 50 });

    return NextResponse.json({
      jobs,
      totalResults: results.jobs.length,
      sources: results.sources,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Write `/api/jobs/dismiss` POST route**

Accepts: `{ jobListingId }`
Calls: `dismissJob(jobListingId)`

**Step 3: Commit**

```bash
git add src/app/api/jobs/
git commit -m "feat: add API routes for job search and dismiss"
```

---

### Task 8: Create API Routes - Applications

**Files:**
- Create: `src/app/api/applications/route.ts` (GET list, POST create)
- Create: `src/app/api/applications/[id]/route.ts` (PATCH update, DELETE)

**Step 1: Write routes**

`POST /api/applications` - `{ jobListingId }` -> createApplication
`PATCH /api/applications/[id]` - `{ status, notes?, ... }` -> updateApplicationStatus
`DELETE /api/applications/[id]` -> deleteApplication

**Step 2: Add Zod validation for each route**

**Step 3: Commit**

```bash
git add src/app/api/applications/
git commit -m "feat: add API routes for applications CRUD"
```

---

### Task 9: Create API Route - Profile

**Files:**
- Create: `src/app/api/profile/route.ts` (GET, PATCH)

**Step 1: Write routes**

`GET /api/profile` -> getProfile(USER_ID)
`PATCH /api/profile` -> updateProfile(USER_ID, body)

Body validation for PATCH:
```typescript
const ProfileUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  preferred_language: z.enum(["fr", "en"]).optional(),
  search_preferences: z.object({
    keywords: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    salary_min: z.number().optional(),
    salary_currency: z.string().optional(),
    remote_preference: z.enum(["remote", "hybrid", "any"]).optional(),
    notification_frequency: z.enum(["manual", "daily", "weekly"]).optional(),
    notification_hour: z.number().int().min(0).max(23).optional(),
    alert_threshold: z.number().int().min(0).max(100).optional(),
  }).optional(),
});
```

**Step 2: Commit**

```bash
git add src/app/api/profile/
git commit -m "feat: add API route for profile get/update"
```

---

### Task 10: Connect Dashboard Page to Supabase

**Files:**
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`
- Modify: `src/components/dashboard/stats-cards.tsx`
- Modify: `src/components/dashboard/top-jobs.tsx`
- Modify: `src/components/dashboard/recent-applications.tsx`

**Step 1: Convert dashboard page to Server Component**

```typescript
// src/app/[locale]/(app)/dashboard/page.tsx
// REMOVE "use client"
import { getTranslations } from "next-intl/server";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopJobs } from "@/components/dashboard/top-jobs";
import { RecentApplications } from "@/components/dashboard/recent-applications";
import { getApplicationStats } from "@/lib/supabase/queries";
import { getJobs } from "@/lib/supabase/queries";
import { getScoreMap } from "@/lib/supabase/queries";
import { getApplications } from "@/lib/supabase/queries";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  // Fetch real data in parallel
  const [stats, jobs, applications] = await Promise.all([
    getApplicationStats(),
    getJobs({ limit: 50 }),
    getApplications(),
  ]);

  // Get scores for fetched jobs
  const jobIds = jobs.map((j) => j.id);
  const scoreMap = jobIds.length > 0 ? await getScoreMap(jobIds) : {};

  // Top 5 jobs sorted by score
  const topJobs = [...jobs]
    .sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
    .slice(0, 5);

  // Recent 3 applications (varied statuses)
  const recentApps = applications.slice(0, 3);

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <StatsCards stats={stats} />
      <TopJobs jobs={topJobs} scoreMap={scoreMap} />
      <RecentApplications applications={recentApps} />
    </div>
  );
}
```

**Step 2: Update StatsCards to accept real stats interface (not MockStats)**

Replace `MockStats` prop with a proper interface:
```typescript
interface DashboardStats {
  newJobs: number;
  avgScore: number;
  activeApplications: number;
  upcomingInterviews: number;
}
```

**Step 3: Update TopJobs to accept props instead of importing mockJobs**

Change from internal mock data to `jobs` and `scoreMap` props.

**Step 4: Update RecentApplications to accept props instead of importing mockApplications**

Change from internal mock data to `applications` prop with real DB shape.

**Step 5: Run dev server and verify dashboard loads**

**Step 6: Commit**

```bash
git add src/app/[locale]/(app)/dashboard/ src/components/dashboard/
git commit -m "feat: connect dashboard to Supabase data"
```

---

### Task 11: Connect Jobs Page to Supabase

**Files:**
- Modify: `src/app/[locale]/(app)/jobs/page.tsx`
- Modify: `src/components/jobs/job-list.tsx`
- Modify: `src/components/jobs/job-card.tsx` (if needed)

**Step 1: Convert jobs page to Server Component for initial data fetch**

Fetch jobs + scores server-side, pass as props to JobList.

**Step 2: Update JobList to accept initial data as props**

- Receives `initialJobs` and `initialScoreMap` as props
- Still has client-side filter state
- Filters run client-side on the pre-fetched data
- "Search new jobs" button triggers `/api/jobs/search` POST call
- Dismiss button triggers `/api/jobs/dismiss` POST call

**Step 3: Update JobCard score prop to come from scoreMap**

**Step 4: Commit**

```bash
git add src/app/[locale]/(app)/jobs/ src/components/jobs/
git commit -m "feat: connect jobs page to Supabase data"
```

---

### Task 12: Connect Applications Page to Supabase

**Files:**
- Modify: `src/app/[locale]/(app)/applications/page.tsx`
- Modify: `src/components/applications/kanban-board.tsx`
- Modify: `src/components/applications/kanban-column.tsx`
- Modify: `src/components/applications/kanban-card.tsx`
- Modify: `src/components/applications/list-view.tsx`

**Step 1: Convert applications page to Server Component**

Fetch applications server-side, pass to KanbanBoard/ListView.

**Step 2: Define ApplicationWithJob type**

```typescript
// Application row joined with job_listings for display
interface ApplicationWithJob {
  id: string;
  status: string;
  saved_at: string;
  applied_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
  notes: string | null;
  priority: number;
  salary_offered: number | null;
  job_listing: {
    id: string;
    title: string;
    company_name: string | null;
    location: string | null;
    source_url: string;
  };
  score?: number;
}
```

**Step 3: Update KanbanBoard to accept applications as props**

Replace `mockApplications` import with prop-based data. Group by status.

**Step 4: Update ListView to accept applications as props**

Replace `mockApplications` import. Status change calls `PATCH /api/applications/[id]`.

**Step 5: Commit**

```bash
git add src/app/[locale]/(app)/applications/ src/components/applications/
git commit -m "feat: connect applications page to Supabase data"
```

---

### Task 13: Connect Settings Page to Supabase

**Files:**
- Modify: `src/app/[locale]/(app)/settings/page.tsx`
- Modify: `src/components/settings/profile-form.tsx`
- Modify: `src/components/settings/search-preferences.tsx`
- Modify: `src/components/settings/notification-settings.tsx`

**Step 1: Convert settings page to Server Component for initial data**

Fetch profile server-side, pass to child form components.

**Step 2: Update ProfileForm**

- Accept `profile` prop instead of using `mockProfile`
- Save button calls `PATCH /api/profile`
- Show toast on success/error

**Step 3: Update SearchPreferences**

- Accept profile's `search_preferences` as prop
- Extract keywords, locations, salaryMin, etc.
- Save button calls `PATCH /api/profile` with updated `search_preferences`

**Step 4: Update NotificationSettings**

- Accept profile's `search_preferences` as prop (frequency, hour stored there)
- Save button calls `PATCH /api/profile`

**Step 5: Commit**

```bash
git add src/app/[locale]/(app)/settings/ src/components/settings/
git commit -m "feat: connect settings to Supabase profile data"
```

---

### Task 14: Create Supabase Storage Bucket + CV Upload

**Files:**
- Create migration or use MCP to create storage bucket `resumes`
- Modify: `src/components/settings/cv-upload.tsx`
- Create: `src/app/api/resumes/upload/route.ts`

**Step 1: Create storage bucket**

Via Supabase MCP or migration:
- Bucket name: `resumes`
- Public: false (private, accessed via service_role)
- File size limit: 10MB
- Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`

**Step 2: Write upload API route**

`POST /api/resumes/upload` - accepts FormData with file
1. Upload file to Supabase Storage `resumes/{userId}/{filename}`
2. If file is .txt, extract text directly
3. If file is .pdf/.docx, store raw and parse with CV Parser service later
4. Insert row in `resumes` table
5. Return resume record

**Step 3: Update CVUpload component**

- On file select, POST to `/api/resumes/upload` with FormData
- Show upload progress
- Display uploaded file from DB data (not just local state)
- Delete button calls `DELETE /api/resumes/[id]`

**Step 4: Commit**

```bash
git add src/app/api/resumes/ src/components/settings/cv-upload.tsx
git commit -m "feat: add CV upload to Supabase Storage"
```

---

### Task 15: Seed Initial Data for Testing

**Files:**
- Create: `src/lib/supabase/seed.ts`
- Create: `src/app/api/dev/seed/route.ts` (dev only)

**Step 1: Write seed function**

Takes the 15 mock jobs from `mock-data.ts`, inserts them into `job_listings`.
Creates 10 mock applications linked to those jobs.
Sets mock scores.

**Step 2: Create dev-only API route**

`POST /api/dev/seed` - only works in development
- Calls seed function
- Returns count of inserted records

**Step 3: Run seed to populate DB for manual testing**

**Step 4: Commit**

```bash
git add src/lib/supabase/seed.ts src/app/api/dev/seed/
git commit -m "feat: add dev seed route for testing"
```

---

### Task 16: Integration Tests with Real Supabase

**Files:**
- Create: `src/__integration__/supabase-queries.integration.test.ts`

**Step 1: Write integration tests**

Test against real Supabase (requires env vars):
- Insert a job, verify it appears in getJobs()
- Create application for that job, verify getApplications()
- Update application status, verify activity_log trigger fired
- Update profile, verify getProfile() returns new data
- Dismiss a job, verify getDismissedJobIds() includes it

**Step 2: Run integration tests**

Run: `npx vitest run src/__integration__/supabase-queries.integration.test.ts`

**Step 3: Commit**

```bash
git add src/__integration__/supabase-queries.integration.test.ts
git commit -m "test: add Supabase integration tests"
```

---

### Task 17: Remove Mock Data Dependency

**Files:**
- Modify: All files that import from `@/lib/mock-data`
- Keep: `src/lib/mock-data.ts` (but only for dev seed reference)

**Step 1: Search all imports of mock-data**

Run: `grep -r "mock-data" src/ --include="*.tsx" --include="*.ts" -l`

**Step 2: Verify each file no longer needs mock-data**

After Tasks 10-14, all components should receive data via props from server components.

**Step 3: Remove mock-data imports from all production components**

Keep the file itself for seed script reference, but no production code should import it.

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Run build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove mock-data dependency from all production components"
```

---

### Task 18: Final Verification + Build

**Step 1: Run full test suite**

```bash
npx vitest run
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Manual smoke test**

- Dashboard loads with real data (or empty state if no seed)
- Jobs page shows jobs from DB
- Applications page shows applications from DB
- Settings loads profile from DB
- Settings save updates profile in DB
- Job search triggers API call and populates DB

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 5 - Supabase Integration"
```

---

## Summary of Deliverables

| # | Task | Files Created/Modified |
|---|------|----------------------|
| 0 | Fix DB CHECK constraints | migration + types |
| 1 | Query layer: Profiles | 2 files |
| 2 | Query layer: Jobs | 2 files |
| 3 | Query layer: Applications | 2 files |
| 4 | Query layer: Match Scores | 2 files |
| 5 | Query layer: Resumes | 2 files |
| 6 | Query layer: Index + Constants | 2 files |
| 7 | API routes: Jobs | 2 files |
| 8 | API routes: Applications | 2 files |
| 9 | API route: Profile | 1 file |
| 10 | Connect Dashboard | 4 files |
| 11 | Connect Jobs | 3 files |
| 12 | Connect Applications | 5 files |
| 13 | Connect Settings | 4 files |
| 14 | CV Upload to Storage | 3 files |
| 15 | Dev Seed | 2 files |
| 16 | Integration Tests | 1 file |
| 17 | Remove mock-data dependency | Multiple |
| 18 | Final verification | 0 files |

**Total: ~19 tasks, ~37 files created/modified**

## Execution Order

Tasks 0-6 are **data layer** (can be done sequentially, each builds on prior).
Tasks 7-9 are **API routes** (depend on Tasks 1-6).
Tasks 10-14 are **frontend connections** (depend on Tasks 7-9, can be parallelized).
Task 15 is **seed data** (can be done after Task 6).
Tasks 16-18 are **verification** (done last).
