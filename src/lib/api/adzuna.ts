import {
  AdzunaJobSchema,
  normalizeAdzunaJob,
  type UnifiedJob,
} from "@/lib/schemas/job";
import { getEnv } from "@/lib/env";
import { z } from "zod";

export interface AdzunaSearchParams {
  keywords: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  page?: number;
  resultsPerPage?: number;
  sortBy?: "relevance" | "date" | "salary";
  maxDaysOld?: number;
  category?: string;
  fullTime?: boolean;
}

const AdzunaResponseSchema = z.object({
  count: z.number(),
  results: z.array(z.unknown()),
});

export async function searchAdzuna(
  params: AdzunaSearchParams
): Promise<{ jobs: UnifiedJob[]; total: number }> {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY, ADZUNA_COUNTRY } = getEnv();

  const page = params.page || 1;
  const resultsPerPage = params.resultsPerPage || 20;

  const url = new URL(
    `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/${page}`
  );
  url.searchParams.set("app_id", ADZUNA_APP_ID);
  url.searchParams.set("app_key", ADZUNA_APP_KEY);
  url.searchParams.set("what", params.keywords);
  url.searchParams.set("results_per_page", String(resultsPerPage));

  if (params.location) {
    url.searchParams.set("where", params.location);
  }
  if (params.salaryMin) {
    url.searchParams.set("salary_min", String(params.salaryMin));
  }
  if (params.salaryMax) {
    url.searchParams.set("salary_max", String(params.salaryMax));
  }
  if (params.sortBy) {
    url.searchParams.set("sort_by", params.sortBy);
  }
  if (params.maxDaysOld) {
    url.searchParams.set("max_days_old", String(params.maxDaysOld));
  }
  if (params.category) {
    url.searchParams.set("category", params.category);
  }
  if (params.fullTime !== undefined) {
    url.searchParams.set("full_time", params.fullTime ? "1" : "0");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Adzuna API error: ${response.status} ${response.statusText}`
      );
    }

    const data = AdzunaResponseSchema.parse(await response.json());

    const jobs: UnifiedJob[] = [];
    for (const rawJob of data.results) {
      const parsed = AdzunaJobSchema.safeParse(rawJob);
      if (parsed.success) {
        jobs.push(normalizeAdzunaJob(parsed.data));
      }
    }

    return { jobs, total: data.count };
  } finally {
    clearTimeout(timeout);
  }
}
