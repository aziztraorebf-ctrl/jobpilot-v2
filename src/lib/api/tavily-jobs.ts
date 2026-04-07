import { getTavilyClient } from "./tavily";
import { computeDedupHash, type UnifiedJob } from "@/lib/schemas/job";

const INCLUDE_DOMAINS = [
  "jobillico.com",
  "jobboom.com",
  "emploiquebec.gouv.qc.ca",
  "garda.com",
  "securitas.com",
];

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
    .filter((r: TavilyResult) => r.title && r.url && r.content)
    .map((r: TavilyResult) => normalizeTavilyResult(r));

  return { jobs, total: jobs.length };
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

function normalizeTavilyResult(raw: TavilyResult): UnifiedJob {
  const title = raw.title.replace(/\s*[|–—-]\s*[^|–—-]+$/, "").trim();
  const titleParts = raw.title.split(/\s*[|–—-]\s*/);
  const company =
    titleParts.length >= 2
      ? titleParts[titleParts.length - 2]?.trim() || null
      : null;

  const locationMatch = raw.content.match(
    /(?:Montreal|Montr[eé]al|Laval|Longueuil|Quebec|Qu[eé]bec|Ottawa|Toronto|Lachine|Gatineau)[^.,]*/i
  );
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
