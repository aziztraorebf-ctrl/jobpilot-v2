# Tavily Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Branch:** `feat/tavily-integration`

**Goal:** Add Tavily as a complementary web search source for job discovery, alongside JSearch and Adzuna, using 1 search/day on the active rotation profile only.

**Architecture:** Tavily `search()` replaces Firecrawl `search()` as the web search source in the job aggregator and Scout mode 2. Firecrawl remains for scrape/interact/agent. Tavily targets Quebec-local job boards (Jobillico, Jobboom, etc.) that JSearch/Adzuna don't cover. Graceful degradation: if no `TAVILY_API_KEY`, Tavily is silently skipped.

**Tech Stack:** `@tavily/core` SDK, TypeScript, Vitest

---

## Pre-Task: Update keywords in Supabase + fix Zod limit

These are done before branching (direct DB update + small schema fix on main).

### Task 0A: Update rotation profile keywords in Supabase

**Step 1: Update keywords via Supabase REST API**

```bash
curl -X PATCH "https://mhtwasxiljjhpzilyosd.supabase.co/rest/v1/profiles?id=eq.01a4b92c-f33f-4b1c-a73b-a01d5a5f55e2" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"search_preferences": <updated JSON with new keywords>}'
```

New rotation_profiles keywords:
- **Securite:** `["Security Supervisor", "Superviseur securite", "Superviseur de site", "Security Manager", "Coordonnateur securite", "Security Operations Supervisor", "Agent de prevention"]`
- **Coordination:** `["Coordinateur logistique", "Logistics Coordinator", "Coordonnateur operations", "Operations Supervisor", "Superviseur operations", "Coordinateur evenementiel", "Chef de projet"]`
- **Large:** `["Warehouse Supervisor", "Superviseur entrepot", "Retail Supervisor", "Store Supervisor", "Representant service clientele", "Customer Service Supervisor", "commis", "reception", "employe polyvalent"]`

Top-level `keywords` array should match the active profile (Coordination, index 1).

**Step 2: Verify the update**

Query profiles and confirm keywords match.

### Task 0B: Fix Zod rotation_profiles max from 2 to 3

**Files:**
- Modify: `src/lib/schemas/search-profiles.ts:9`
- Modify: `src/lib/utils/__tests__/search-profile-helpers.test.ts` (if max is tested)

**Step 1: Change max(2) to max(3)**

In `src/lib/schemas/search-profiles.ts` line 10:
```typescript
// Before:
rotation_profiles: z.array(SearchProfileSchema).min(1).max(2),
// After:
rotation_profiles: z.array(SearchProfileSchema).min(1).max(3),
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/utils/__tests__/search-profile-helpers.test.ts
```

**Step 3: Commit on main**

```bash
git add src/lib/schemas/search-profiles.ts
git commit -m "fix: allow 3 rotation profiles in Zod schema"
```

---

## Task 1: Create branch + install Tavily SDK

**Step 1: Create branch**

```bash
git checkout -b feat/tavily-integration
```

**Step 2: Install SDK**

```bash
npm install @tavily/core
```

**Step 3: Add env var to .env.local**

Add `TAVILY_API_KEY=tvly-...` to `.env.local`

**Step 4: Add to .env.example and .env.production.example**

```
TAVILY_API_KEY=
```

**Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .env.production.example
git commit -m "chore: add @tavily/core SDK + env var placeholder"
```

---

## Task 2: Create Tavily client wrapper

**Files:**
- Create: `src/lib/api/tavily.ts`

**Step 1: Write the client wrapper**

```typescript
import { tavily } from "@tavily/core";

let client: ReturnType<typeof tavily> | null = null;

export function isTavilyAvailable(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export function getTavilyClient() {
  if (!client) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY is not set");
    client = tavily({ apiKey });
  }
  return client;
}
```

**Step 2: Commit**

```bash
git add src/lib/api/tavily.ts
git commit -m "feat: add Tavily client wrapper with graceful check"
```

---

## Task 3: Create tavily-jobs module (search + normalize)

**Files:**
- Create: `src/lib/api/tavily-jobs.ts`
- Create: `src/lib/api/__tests__/tavily-jobs.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/api/__tests__/tavily-jobs.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/tavily", () => ({
  getTavilyClient: vi.fn().mockReturnValue({
    search: vi.fn().mockResolvedValue({
      results: [
        {
          title: "Security Supervisor - GardaWorld | Jobillico",
          url: "https://www.jobillico.com/offer/123",
          content: "GardaWorld is hiring a Security Supervisor in Montreal. Requirements: BSP, bilingual FR/EN, 3+ years experience. Full-time, $25-30/hr.",
          score: 0.95,
        },
        {
          title: "Superviseur entrepot - Amazon | Jobboom",
          url: "https://www.jobboom.com/offer/456",
          content: "Amazon recherche un superviseur d'entrepot a Lachine. Temps plein, avantages sociaux.",
          score: 0.88,
        },
      ],
    }),
  }),
  isTavilyAvailable: vi.fn().mockReturnValue(true),
}));

describe("searchTavily", () => {
  it("returns normalized UnifiedJob array from Tavily results", async () => {
    const { searchTavily } = await import("../tavily-jobs");
    const result = await searchTavily({ keywords: "Security Supervisor", location: "Montreal" });

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].source).toBe("tavily");
    expect(result.jobs[0].title).toBe("Security Supervisor - GardaWorld");
    expect(result.jobs[0].source_url).toBe("https://www.jobillico.com/offer/123");
    expect(result.jobs[0].description).toContain("GardaWorld");
    expect(result.jobs[0].dedup_hash).toBeTruthy();
  });

  it("filters out results without meaningful content", async () => {
    const { getTavilyClient } = await import("@/lib/api/tavily");
    vi.mocked(getTavilyClient).mockReturnValue({
      search: vi.fn().mockResolvedValue({
        results: [
          { title: "", url: "https://example.com", content: "", score: 0.5 },
        ],
      }),
    } as never);

    const { searchTavily } = await import("../tavily-jobs");
    const result = await searchTavily({ keywords: "test" });
    expect(result.jobs).toHaveLength(0);
  });

  it("passes include_domains and exclude_domains to Tavily", async () => {
    const { getTavilyClient } = await import("@/lib/api/tavily");
    const mockSearch = vi.fn().mockResolvedValue({ results: [] });
    vi.mocked(getTavilyClient).mockReturnValue({ search: mockSearch } as never);

    const { searchTavily } = await import("../tavily-jobs");
    await searchTavily({ keywords: "test", location: "Montreal" });

    expect(mockSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        includeDomains: expect.arrayContaining(["jobillico.com"]),
        excludeDomains: expect.arrayContaining(["indeed.com"]),
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/api/__tests__/tavily-jobs.test.ts
```

Expected: FAIL — module `../tavily-jobs` does not exist.

**Step 3: Implement tavily-jobs.ts**

```typescript
// src/lib/api/tavily-jobs.ts
import { getTavilyClient } from "./tavily";
import { computeDedupHash, type UnifiedJob } from "@/lib/schemas/job";

// Quebec-local job boards not covered by JSearch/Adzuna
const INCLUDE_DOMAINS = [
  "jobillico.com",
  "jobboom.com",
  "emploiquebec.gouv.qc.ca",
  "garda.com",
  "securitas.com",
  "ca.indeed.com",
];

// Already covered by JSearch — avoid duplicates
const EXCLUDE_DOMAINS = [
  "indeed.com",
  "glassdoor.com",
  "linkedin.com",
  "ziprecruiter.com",
];

export interface TavilySearchParams {
  keywords: string;
  location?: string;
  limit?: number;
}

export interface TavilySearchResult {
  jobs: UnifiedJob[];
  total: number;
}

export async function searchTavily(
  params: TavilySearchParams
): Promise<TavilySearchResult> {
  const client = getTavilyClient();
  const query = params.location
    ? `${params.keywords} emploi ${params.location}`
    : `${params.keywords} emploi Canada`;

  const response = await client.search(query, {
    maxResults: params.limit || 10,
    searchDepth: "basic",
    includeDomains: INCLUDE_DOMAINS,
    excludeDomains: EXCLUDE_DOMAINS,
  });

  const results = response.results || [];
  const jobs: UnifiedJob[] = results
    .filter((r) => r.title && r.url && r.content)
    .map((r) => normalizeTavilyResult(r));

  return { jobs, total: jobs.length };
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

function normalizeTavilyResult(raw: TavilyResult): UnifiedJob {
  // Clean title: remove site suffix like " | Jobillico" or " - Jobboom"
  const title = raw.title.replace(/\s*[\|–—-]\s*[^|–—-]+$/, "").trim();
  // Try to extract company from title pattern "Role - Company"
  const titleParts = raw.title.split(/\s*[\|–—-]\s*/);
  const company = titleParts.length >= 2 ? titleParts[titleParts.length - 2]?.trim() || null : null;

  // Try to detect location from content
  const locationMatch = raw.content.match(/(?:Montreal|Montréal|Laval|Longueuil|Quebec|Québec|Ottawa|Toronto)[^.,]*/i);
  const location = locationMatch ? locationMatch[0].trim() : null;

  return {
    source: "tavily",
    source_id: null,
    source_url: raw.url,
    dedup_hash: computeDedupHash(title, company, location),
    title,
    company_name: company,
    location,
    location_lat: null,
    location_lng: null,
    description: raw.content,
    salary_min: null,
    salary_max: null,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: null,
    category: null,
    contract_type: null,
    remote_type: "unknown",
    posted_at: null,
    raw_data: raw,
  };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/api/__tests__/tavily-jobs.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/api/tavily-jobs.ts src/lib/api/__tests__/tavily-jobs.test.ts
git commit -m "feat: add Tavily job search module with normalization + tests"
```

---

## Task 4: Add "tavily" to UnifiedJob source enum

**Files:**
- Modify: `src/lib/schemas/job.ts:45`

**Step 1: Add "tavily" to the source enum**

```typescript
// Before:
source: z.enum(["jooble", "adzuna", "jsearch", "firecrawl", "manual"]),
// After:
source: z.enum(["jooble", "adzuna", "jsearch", "firecrawl", "tavily", "manual"]),
```

**Step 2: Run all tests to confirm nothing breaks**

```bash
npx vitest run
```

**Step 3: Commit**

```bash
git add src/lib/schemas/job.ts
git commit -m "feat: add 'tavily' to UnifiedJob source enum"
```

---

## Task 5: Add Tavily to job-aggregator

**Files:**
- Modify: `src/lib/services/job-aggregator.ts`
- Modify: `src/lib/services/__tests__/job-aggregator.test.ts`

**Step 1: Write the failing test**

Add to existing test file:

```typescript
// Add mock at top level alongside existing mocks:
vi.mock("@/lib/api/tavily-jobs", () => ({
  searchTavily: vi.fn().mockResolvedValue({
    jobs: [
      {
        source: "tavily", source_id: null, source_url: "https://jobillico.com/offer/1",
        dedup_hash: "hash_c", title: "Superviseur", company_name: "GardaWorld",
        location: "Montreal", location_lat: null, location_lng: null,
        description: "Superviseur securite", salary_min: null, salary_max: null,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: null, category: null, contract_type: null,
        remote_type: "unknown", posted_at: null, raw_data: {},
      },
    ],
    total: 1,
  }),
}));

vi.mock("@/lib/api/tavily", () => ({
  isTavilyAvailable: vi.fn().mockReturnValue(true),
}));

// Add new test:
it("includes tavily results when tavily source is requested", async () => {
  const params: AggregateSearchParams = {
    keywords: "superviseur",
    location: "Montreal",
    sources: ["jsearch", "adzuna", "tavily"],
  };
  const result = await aggregateJobSearch(params);
  expect(result.totalTavily).toBe(1);
  const tavilyJob = result.jobs.find((j) => j.source === "tavily");
  expect(tavilyJob).toBeDefined();
  expect(tavilyJob?.company_name).toBe("GardaWorld");
});
```

**Step 2: Run test — expect FAIL**

```bash
npx vitest run src/lib/services/__tests__/job-aggregator.test.ts
```

**Step 3: Modify job-aggregator.ts**

```typescript
// Add import at top:
import { searchTavily } from "@/lib/api/tavily-jobs";
import { isTavilyAvailable } from "@/lib/api/tavily";

// Update AggregateSearchParams sources type:
sources?: ("jsearch" | "adzuna" | "firecrawl" | "tavily")[];

// Update AggregateSearchResult:
totalTavily: number;

// Add tavily block inside aggregateJobSearch, after firecrawl block:
let tavilyJobs: UnifiedJob[] = [];
let totalTavily = 0;

if (sources.includes("tavily") && isTavilyAvailable()) {
  promises.push(
    searchTavily({
      keywords: params.keywords,
      location: params.location,
      limit: 10,
    })
      .then((result) => {
        tavilyJobs = result.jobs;
        totalTavily = result.total;
      })
      .catch((err) => {
        errors.push(`Tavily: ${err instanceof Error ? err.message : String(err)}`);
      })
  );
}

// Update allJobs:
const allJobs = [...jsearchJobs, ...adzunaJobs, ...firecrawlJobs, ...tavilyJobs];

// Update return:
return { jobs: deduplicated, totalJSearch, totalAdzuna, totalFirecrawl, totalTavily, errors };
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/services/__tests__/job-aggregator.test.ts
```

**Step 5: Fix any other tests that depend on AggregateSearchResult shape (add totalTavily: 0)**

```bash
npx vitest run
```

**Step 6: Commit**

```bash
git add src/lib/services/job-aggregator.ts src/lib/services/__tests__/job-aggregator.test.ts
git commit -m "feat: add Tavily as search source in job aggregator"
```

---

## Task 6: Add Tavily to fetch-jobs cron

**Files:**
- Modify: `src/app/api/cron/fetch-jobs/route.ts:75`

**Step 1: Modify the aggregateJobSearch call**

The cron currently calls `aggregateJobSearch({ keywords: query, location })` which defaults to `["jsearch", "adzuna"]`.

Change line 75 to include tavily:

```typescript
// Before:
const result = await aggregateJobSearch({ keywords: query, location });
// After:
const result = await aggregateJobSearch({ keywords: query, location, sources: ["jsearch", "adzuna", "tavily"] });
```

This is a one-line change. Tavily will be silently skipped if `TAVILY_API_KEY` is not set (the `isTavilyAvailable()` check in aggregator handles this).

**Step 2: Commit**

```bash
git add src/app/api/cron/fetch-jobs/route.ts
git commit -m "feat: include Tavily in daily fetch-jobs cron"
```

---

## Task 7: Replace Firecrawl with Tavily in Scout mode 2

**Files:**
- Modify: `src/lib/services/scout.ts`

**Step 1: Modify scoutSearch to prefer Tavily over Firecrawl for search**

```typescript
// Replace scoutSearch function:
async function scoutSearch(input: ScoutSearchInput): Promise<ScoutResult> {
  // Prefer Tavily for web search (cheaper, better search relevance)
  if (isTavilyAvailable()) {
    return scoutSearchTavily(input);
  }

  // Fallback to Firecrawl if available
  if (isFirecrawlAvailable()) {
    return scoutSearchFirecrawl(input);
  }

  // Final fallback: free sources
  return scoutSearchFree(input);
}
```

Add the Tavily search function:

```typescript
import { searchTavily } from "@/lib/api/tavily-jobs";
import { isTavilyAvailable } from "@/lib/api/tavily";

async function scoutSearchTavily(input: ScoutSearchInput): Promise<ScoutResult> {
  const result = await searchTavily({
    keywords: input.keywords,
    location: input.location,
    limit: input.limit || 10,
  });

  return {
    jobs: result.jobs,
    errors: [],
    creditsUsed: 1, // 1 Tavily credit per basic search
  };
}
```

**Step 2: Run scout tests**

```bash
npx vitest run src/lib/services/__tests__/scout.test.ts
```

**Step 3: Commit**

```bash
git add src/lib/services/scout.ts
git commit -m "feat: Scout mode 2 prefers Tavily for web search, Firecrawl as fallback"
```

---

## Task 8: Update search-preferences sources type

**Files:**
- Modify: `src/types/search-preferences.ts:8`

**Step 1: Add tavily to sources type**

```typescript
// Before:
sources: ("jsearch" | "adzuna")[];
// After:
sources: ("jsearch" | "adzuna" | "tavily")[];
```

**Step 2: Update DEFAULTS to include tavily**

```typescript
// Before:
sources: ["jsearch", "adzuna"],
// After:
sources: ["jsearch", "adzuna", "tavily"],
```

**Step 3: Run all tests**

```bash
npx vitest run
```

**Step 4: Commit**

```bash
git add src/types/search-preferences.ts
git commit -m "feat: add 'tavily' to search preferences sources"
```

---

## Task 9: Final validation + merge

**Step 1: Run full test suite**

```bash
npx vitest run
```

**Step 2: Build check**

```bash
npm run build
```

**Step 3: Manual smoke test (optional)**

Test Tavily search directly:

```bash
curl -X POST http://localhost:3000/api/cowork/scout \
  -H "Content-Type: application/json" \
  -d '{"mode": "search", "keywords": "Superviseur securite", "location": "Montreal"}'
```

**Step 4: Merge**

```bash
git checkout main
git merge feat/tavily-integration
git branch -d feat/tavily-integration
```

---

## Summary of changes

| File | Change |
|------|--------|
| `src/lib/api/tavily.ts` | NEW — client wrapper |
| `src/lib/api/tavily-jobs.ts` | NEW — search + normalize to UnifiedJob |
| `src/lib/api/__tests__/tavily-jobs.test.ts` | NEW — 3 tests |
| `src/lib/schemas/job.ts` | ADD "tavily" to source enum |
| `src/lib/schemas/search-profiles.ts` | FIX max(2) → max(3) |
| `src/lib/services/job-aggregator.ts` | ADD tavily source |
| `src/lib/services/__tests__/job-aggregator.test.ts` | ADD tavily test |
| `src/lib/services/scout.ts` | MODIFY search to prefer Tavily |
| `src/types/search-preferences.ts` | ADD "tavily" to sources |
| `src/app/api/cron/fetch-jobs/route.ts` | ADD tavily to cron sources |
| `.env.local` | ADD TAVILY_API_KEY |
| `.env.example` | ADD TAVILY_API_KEY placeholder |

**Credit usage:** ~1 credit/day (1 search basic on active profile) = ~30 credits/mois = 3% du free tier.

**Zero breaking changes.** Agent Cowork voit des jobs avec `source: "tavily"`, meme format UnifiedJob. Pas de nouveau endpoint. Pas de migration DB.
