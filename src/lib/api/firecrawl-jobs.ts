import { getFirecrawlClient } from "./firecrawl";
import { computeDedupHash, type UnifiedJob } from "@/lib/schemas/job";

// JSON Schema (not Zod) — Firecrawl SDK expects Record<string, unknown> with Zod v4
export const FIRECRAWL_JOB_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    company_name: { type: "string" },
    location: { type: "string" },
    description: { type: "string" },
    salary_min: { type: "number" },
    salary_max: { type: "number" },
    salary_currency: { type: "string" },
    job_type: { type: "string" },
    contract_type: { type: "string" },
    remote_type: { type: "string", enum: ["onsite", "hybrid", "remote", "unknown"] },
    posted_at: { type: "string" },
    application_url: { type: "string" },
  },
  required: ["title"],
};

export interface FirecrawlJobExtract {
  title: string;
  company_name?: string | null;
  location?: string | null;
  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  job_type?: string | null;
  contract_type?: string | null;
  remote_type?: "onsite" | "hybrid" | "remote" | "unknown";
  posted_at?: string | null;
  application_url?: string | null;
}

export interface FirecrawlSearchParams {
  keywords: string;
  location?: string;
  limit?: number;
}

export interface FirecrawlSearchResult {
  jobs: UnifiedJob[];
  total: number;
}

export async function searchFirecrawl(
  params: FirecrawlSearchParams
): Promise<FirecrawlSearchResult> {
  const client = getFirecrawlClient();
  const query = params.location
    ? `${params.keywords} jobs in ${params.location}`
    : `${params.keywords} jobs`;

  const results = await client.search(query, {
    limit: params.limit || 10,
    scrapeOptions: {
      formats: [{ type: "json", schema: FIRECRAWL_JOB_SCHEMA }],
    },
  });

  const webResults = results.web || [];
  const jobs: UnifiedJob[] = webResults
    .filter((r): r is typeof r & { json: FirecrawlJobExtract } =>
      "json" in r && Boolean((r as { json?: { title?: string } }).json?.title)
    )
    .map((r) =>
      normalizeFirecrawlJob(
        r.json as FirecrawlJobExtract,
        "url" in r ? (r as { url: string }).url : ""
      )
    );

  return { jobs, total: jobs.length };
}

const VALID_REMOTE_TYPES = new Set(["onsite", "hybrid", "remote", "unknown"]);

export function normalizeFirecrawlJob(
  raw: FirecrawlJobExtract,
  sourceUrl: string
): UnifiedJob {
  const title = raw.title || "Unknown";
  const company = raw.company_name || null;
  const location = raw.location || null;

  return {
    source: "firecrawl",
    source_id: null,
    source_url: raw.application_url || sourceUrl,
    dedup_hash: computeDedupHash(title, company, location),
    title,
    company_name: company,
    location,
    location_lat: null,
    location_lng: null,
    description: raw.description || null,
    salary_min: raw.salary_min ?? null,
    salary_max: raw.salary_max ?? null,
    salary_currency: raw.salary_currency || "CAD",
    salary_is_predicted: false,
    job_type: raw.job_type || null,
    category: null,
    contract_type: raw.contract_type || null,
    remote_type: VALID_REMOTE_TYPES.has(raw.remote_type ?? "")
      ? (raw.remote_type as "onsite" | "hybrid" | "remote" | "unknown")
      : "unknown",
    posted_at: raw.posted_at && !isNaN(Date.parse(raw.posted_at))
      ? raw.posted_at
      : null,
    raw_data: raw,
  };
}
