import { searchJSearch } from "@/lib/api/jsearch";
import { searchAdzuna } from "@/lib/api/adzuna";
import { searchFirecrawl } from "@/lib/api/firecrawl-jobs";
import { deduplicateJobs } from "./deduplicator";
import type { UnifiedJob } from "@/lib/schemas/job";

export interface AggregateSearchParams {
  keywords: string;
  location?: string;
  salaryMin?: number;
  page?: number;
  sources?: ("jsearch" | "adzuna" | "firecrawl")[];
}

export interface AggregateSearchResult {
  jobs: UnifiedJob[];
  totalJSearch: number;
  totalAdzuna: number;
  totalFirecrawl: number;
  errors: string[];
}

export async function aggregateJobSearch(params: AggregateSearchParams): Promise<AggregateSearchResult> {
  // Firecrawl excluded from default sources (credit-based, use via /api/cowork/scout instead)
  const sources = params.sources || ["jsearch", "adzuna"];
  const errors: string[] = [];
  let jsearchJobs: UnifiedJob[] = [];
  let adzunaJobs: UnifiedJob[] = [];
  let firecrawlJobs: UnifiedJob[] = [];
  let totalJSearch = 0;
  let totalAdzuna = 0;
  let totalFirecrawl = 0;

  const promises: Promise<void>[] = [];

  if (sources.includes("jsearch")) {
    const query = params.location
      ? `${params.keywords} in ${params.location}`
      : params.keywords;

    promises.push(
      searchJSearch({
        query,
        page: params.page,
      })
        .then((result) => {
          jsearchJobs = result.jobs;
          totalJSearch = result.total;
        })
        .catch((err) => {
          errors.push(`JSearch: ${err instanceof Error ? err.message : String(err)}`);
        })
    );
  }

  if (sources.includes("adzuna")) {
    promises.push(
      searchAdzuna({
        keywords: params.keywords,
        location: params.location,
        salaryMin: params.salaryMin,
        page: params.page,
      })
        .then((result) => {
          adzunaJobs = result.jobs;
          totalAdzuna = result.total;
        })
        .catch((err) => {
          errors.push(`Adzuna: ${err instanceof Error ? err.message : String(err)}`);
        })
    );
  }

  if (sources.includes("firecrawl")) {
    promises.push(
      searchFirecrawl({
        keywords: params.keywords,
        location: params.location,
        limit: 10,
      })
        .then((result) => {
          firecrawlJobs = result.jobs;
          totalFirecrawl = result.total;
        })
        .catch((err) => {
          errors.push(`Firecrawl: ${err instanceof Error ? err.message : String(err)}`);
        })
    );
  }

  await Promise.allSettled(promises);

  const allJobs = [...jsearchJobs, ...adzunaJobs, ...firecrawlJobs];
  const deduplicated = deduplicateJobs(allJobs);

  return { jobs: deduplicated, totalJSearch, totalAdzuna, totalFirecrawl, errors };
}
