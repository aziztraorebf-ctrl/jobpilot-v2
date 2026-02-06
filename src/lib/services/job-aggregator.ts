import { searchJSearch } from "@/lib/api/jsearch";
import { searchAdzuna } from "@/lib/api/adzuna";
import { deduplicateJobs } from "./deduplicator";
import type { UnifiedJob } from "@/lib/schemas/job";

export interface AggregateSearchParams {
  keywords: string;
  location?: string;
  salaryMin?: number;
  page?: number;
  sources?: ("jsearch" | "adzuna")[];
}

export interface AggregateSearchResult {
  jobs: UnifiedJob[];
  totalJSearch: number;
  totalAdzuna: number;
  errors: string[];
}

export async function aggregateJobSearch(params: AggregateSearchParams): Promise<AggregateSearchResult> {
  const sources = params.sources || ["jsearch", "adzuna"];
  const errors: string[] = [];
  let jsearchJobs: UnifiedJob[] = [];
  let adzunaJobs: UnifiedJob[] = [];
  let totalJSearch = 0;
  let totalAdzuna = 0;

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

  await Promise.allSettled(promises);

  const allJobs = [...jsearchJobs, ...adzunaJobs];
  const deduplicated = deduplicateJobs(allJobs);

  return { jobs: deduplicated, totalJSearch, totalAdzuna, errors };
}
