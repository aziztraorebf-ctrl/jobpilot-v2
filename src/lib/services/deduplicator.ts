import type { UnifiedJob } from "@/lib/schemas/job";

const SOURCE_PRIORITY: Record<string, number> = {
  firecrawl: 4,
  manual: 3,
  jsearch: 3,
  adzuna: 2,
  jooble: 1,
  tavily: 1,
};

// Matches listing/category pages that contain no specific job offer.
// Anchored to end of pathname (or query string start) to avoid false positives
// like /search/job/12345 or /emploi-titre-xyz.
const LISTING_URL_PATTERNS = [
  /\/recherche-emploi\/?(\?|$)/,
  /\/recherche-emploi\/[^/]+\/[^/]+\/?(\?|$)/,
  /\/search\/?(\?|$)/,
  /\/browse\/?(\?|$)/,
  /\/jobs?\/category\//,
  /\/job-search\/?(\?|$)/,
  /\/emplois?\/?(\?|$)/,
];

export function isListingPage(url: string): boolean {
  try {
    const u = new URL(url);
    return LISTING_URL_PATTERNS.some((rx) => rx.test(u.pathname + u.search));
  } catch {
    return false;
  }
}

function dataRichness(job: UnifiedJob): number {
  let score = SOURCE_PRIORITY[job.source] ?? 0;
  if (job.salary_min !== null) score += 2;
  if (job.salary_max !== null) score += 1;
  if (job.location_lat !== null) score += 1;
  if (job.category !== null) score += 1;
  if (job.contract_type !== null) score += 1;
  if (job.description && job.description.length > 200) score += 1;
  return score;
}

export function deduplicateJobs(jobs: UnifiedJob[]): UnifiedJob[] {
  const seen = new Map<string, UnifiedJob>();

  for (const job of jobs) {
    if (job.source_url && isListingPage(job.source_url)) continue;

    const existing = seen.get(job.dedup_hash);
    if (!existing || dataRichness(job) > dataRichness(existing)) {
      seen.set(job.dedup_hash, job);
    }
  }

  const orderedHashes: string[] = [];
  const hashSet = new Set<string>();
  for (const job of jobs) {
    if (job.source_url && isListingPage(job.source_url)) continue;
    if (!hashSet.has(job.dedup_hash)) {
      orderedHashes.push(job.dedup_hash);
      hashSet.add(job.dedup_hash);
    }
  }

  return orderedHashes.map((hash) => seen.get(hash)!);
}
