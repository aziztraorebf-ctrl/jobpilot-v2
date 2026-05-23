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

function extractSalary(content: string): { min: number | null; max: number | null } {
  const rangeMatch = content.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\$\s*\/\s*h/i);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }
  const singleMatch =
    content.match(/\$?\s*(\d+(?:\.\d+)?)\s*\$?\s*\/\s*h(?:eure)?/i) ||
    content.match(/(\d+(?:\.\d+)?)\s*\$\s*(?:de\s*l[''']heure|\/h)/i);
  if (singleMatch) {
    return { min: parseFloat(singleMatch[1]), max: null };
  }
  return { min: null, max: null };
}

function extractContractType(content: string): string | null {
  const lower = content.toLowerCase();
  if (/permanent/.test(lower)) return "permanent";
  if (/temps\s+plein/.test(lower)) return "full_time";
  if (/temps\s+partiel/.test(lower)) return "part_time";
  if (/contract(?:uel)?/.test(lower)) return "contract";
  if (/temporaire/.test(lower)) return "temporary";
  return null;
}

function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*[|–—]\s*(jobillico|jobboom|emploi.?qu[eé]bec)[^|–—]*/gi, "")
    .replace(/\s*[|–—]\s*[^|–—]+$/, "")
    .trim();
}

function normalizeTavilyResult(raw: TavilyResult): UnifiedJob {
  const title = cleanTitle(raw.title);

  const titleParts = raw.title.split(/\s*[|–—-]\s*/);
  const company =
    titleParts.length >= 2
      ? titleParts[titleParts.length - 2]?.trim() || null
      : null;

  const locationMatch = raw.content.match(
    /(?:Montreal|Montr[eé]al|Laval|Longueuil|Quebec|Qu[eé]bec|Ottawa|Toronto|Lachine|Gatineau)[^.,]*/i
  );
  const location = locationMatch ? locationMatch[0].trim() : null;

  const { min: salary_min, max: salary_max } = extractSalary(raw.content);
  const contract_type = extractContractType(raw.content);

  const descriptionParts = [raw.content];
  if (salary_min) descriptionParts.push(`Salaire: ${salary_min}${salary_max ? `-${salary_max}` : ""}$/h`);
  if (contract_type) descriptionParts.push(`Contrat: ${contract_type}`);
  if (location) descriptionParts.push(`Lieu: ${location}`);

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
    description: descriptionParts.join(". "),
    salary_min,
    salary_max,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: null,
    category: null,
    contract_type,
    remote_type: /t[eé]l[eé]travail|remote/i.test(raw.content) ? "remote" : "unknown",
    posted_at: null,
    raw_data: raw,
  };
}

export function normalizeTavilyResults(raws: TavilyResult[]): UnifiedJob[] {
  return raws.map(normalizeTavilyResult);
}
