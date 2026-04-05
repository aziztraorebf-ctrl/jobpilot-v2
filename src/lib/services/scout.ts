import {
  normalizeFirecrawlJob,
  type FirecrawlJobExtract,
  FIRECRAWL_JOB_SCHEMA,
} from "@/lib/api/firecrawl-jobs";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import type { UnifiedJob } from "@/lib/schemas/job";

import { getFirecrawlClient } from "@/lib/api/firecrawl";

function isFirecrawlAvailable(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

// --- Types ---

export interface ScoutTargetsInput {
  mode: "targets";
  urls: string[];
}

export interface ScoutSearchInput {
  mode: "search";
  keywords: string;
  location?: string;
  limit?: number;
}

export interface ScoutAgentInput {
  mode: "agent";
  prompt: string;
  urls?: string[];
  maxCredits?: number;
}

export type ScoutInput = ScoutTargetsInput | ScoutSearchInput | ScoutAgentInput;

export interface ScoutResult {
  jobs: UnifiedJob[];
  errors: string[];
  creditsUsed: number;
}

// --- Mode 1: Targets ---

async function scoutTargets(input: ScoutTargetsInput): Promise<ScoutResult> {
  if (!isFirecrawlAvailable()) {
    return { jobs: [], errors: ["Firecrawl API key not configured — targets mode requires Firecrawl"], creditsUsed: 0 };
  }
  const client = getFirecrawlClient();
  const jobs: UnifiedJob[] = [];
  const errors: string[] = [];
  let creditsUsed = 0;

  // Scrape each URL in parallel (max 5 concurrent)
  const chunks = chunkArray(input.urls, 5);

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (url) => {
        const doc = await client.scrape(url, {
          formats: [
            {
              type: "json",
              schema: FIRECRAWL_JOB_SCHEMA_ARRAY,
              prompt:
                "Extract ALL job postings visible on this page. For each job, extract: title, company_name, location, description, salary_min, salary_max, salary_currency, job_type, contract_type, remote_type, posted_at, application_url. Return an array of job objects.",
            },
          ],
        });

        creditsUsed += doc.metadata?.creditsUsed ?? 3;

        // The result could be an array of jobs or a single job
        const extracted = doc.json as
          | FirecrawlJobExtract[]
          | FirecrawlJobExtract
          | { jobs?: FirecrawlJobExtract[] }
          | null;

        return { extracted, sourceUrl: url };
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(
          `Scrape failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
        continue;
      }

      const { extracted, sourceUrl } = result.value;
      const jobList = normalizeExtracted(extracted, sourceUrl);
      jobs.push(...jobList);
    }
  }

  return { jobs, errors, creditsUsed };
}

// --- Mode 2: Search ---

async function scoutSearch(input: ScoutSearchInput): Promise<ScoutResult> {
  // If Firecrawl is available, use it for richer results
  if (isFirecrawlAvailable()) {
    return scoutSearchFirecrawl(input);
  }

  // Fallback: use JSearch + Adzuna (free, no credits needed)
  return scoutSearchFree(input);
}

async function scoutSearchFirecrawl(input: ScoutSearchInput): Promise<ScoutResult> {
  const client = getFirecrawlClient();
  const errors: string[] = [];
  let creditsUsed = 0;

  const query = input.location
    ? `${input.keywords} jobs in ${input.location}`
    : `${input.keywords} jobs`;

  const results = await client.search(query, {
    limit: input.limit || 10,
    scrapeOptions: {
      formats: [{ type: "json", schema: FIRECRAWL_JOB_SCHEMA }],
    },
  });

  const webResults = results.web || [];
  const jobs: UnifiedJob[] = [];

  for (const r of webResults) {
    const credits = (r as { metadata?: { creditsUsed?: number } }).metadata
      ?.creditsUsed;
    if (credits) creditsUsed += credits;

    if ("json" in r) {
      const json = r.json as FirecrawlJobExtract | null;
      if (json?.title) {
        const url = "url" in r ? (r as { url: string }).url : "";
        jobs.push(normalizeFirecrawlJob(json, url));
      }
    }
  }

  return { jobs, errors, creditsUsed };
}

async function scoutSearchFree(input: ScoutSearchInput): Promise<ScoutResult> {
  const result = await aggregateJobSearch({
    keywords: input.keywords,
    location: input.location,
    sources: ["jsearch", "adzuna"],
  });

  return {
    jobs: result.jobs,
    errors: result.errors,
    creditsUsed: 0,
  };
}

// --- Mode 3: Agent ---

async function scoutAgent(input: ScoutAgentInput): Promise<ScoutResult> {
  if (!isFirecrawlAvailable()) {
    return { jobs: [], errors: ["Firecrawl API key not configured — agent mode requires Firecrawl"], creditsUsed: 0 };
  }
  const client = getFirecrawlClient();
  const errors: string[] = [];

  const jobSchema: Record<string, unknown> = {
    type: "object",
    properties: {
      jobs: {
        type: "array",
        items: FIRECRAWL_JOB_SCHEMA,
      },
    },
    required: ["jobs"],
  };

  const result = await client.agent({
    prompt: `${input.prompt}\n\nExtract all matching job postings. For each job provide: title, company_name, location, description, salary_min, salary_max, salary_currency, job_type, contract_type, remote_type, posted_at, application_url.`,
    urls: input.urls,
    schema: jobSchema,
    maxCredits: input.maxCredits || 50,
    timeout: 120,
    pollInterval: 5,
  });

  if (!result.success || result.status === "failed") {
    return {
      jobs: [],
      errors: [`Agent failed: ${result.error || "unknown"}`],
      creditsUsed: result.creditsUsed ?? 0,
    };
  }

  const data = result.data as { jobs?: FirecrawlJobExtract[] } | null;
  const extracted = data?.jobs || [];
  const jobs = extracted
    .filter((j) => j.title)
    .map((j) => normalizeFirecrawlJob(j, j.application_url || ""));

  return {
    jobs,
    errors,
    creditsUsed: result.creditsUsed ?? 0,
  };
}

// --- Main entry ---

export async function runScout(input: ScoutInput): Promise<ScoutResult> {
  switch (input.mode) {
    case "targets":
      return scoutTargets(input);
    case "search":
      return scoutSearch(input);
    case "agent":
      return scoutAgent(input);
  }
}

// --- Helpers ---

// Schema that expects an array of jobs (for targets mode)
const FIRECRAWL_JOB_SCHEMA_ARRAY: Record<string, unknown> = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: FIRECRAWL_JOB_SCHEMA,
    },
  },
  required: ["jobs"],
};

function normalizeExtracted(
  extracted:
    | FirecrawlJobExtract[]
    | FirecrawlJobExtract
    | { jobs?: FirecrawlJobExtract[] }
    | null,
  sourceUrl: string
): UnifiedJob[] {
  if (!extracted) return [];

  // Handle { jobs: [...] } wrapper
  if ("jobs" in extracted && Array.isArray(extracted.jobs)) {
    return extracted.jobs
      .filter((j) => j.title)
      .map((j) => normalizeFirecrawlJob(j, j.application_url || sourceUrl));
  }

  // Handle direct array
  if (Array.isArray(extracted)) {
    return extracted
      .filter((j) => j.title)
      .map((j) => normalizeFirecrawlJob(j, j.application_url || sourceUrl));
  }

  // Handle single job
  if ("title" in extracted && extracted.title) {
    return [normalizeFirecrawlJob(extracted as FirecrawlJobExtract, (extracted as FirecrawlJobExtract).application_url || sourceUrl)];
  }

  return [];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
