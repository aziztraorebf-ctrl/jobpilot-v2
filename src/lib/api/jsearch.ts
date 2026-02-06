import {
  JSearchJobSchema,
  normalizeJSearchJob,
  type UnifiedJob,
} from "@/lib/schemas/job";
import { getEnv } from "@/lib/env";
import { z } from "zod";

export interface JSearchParams {
  query: string;
  page?: number;
  numPages?: number;
  country?: string;
  datePosted?: "all" | "today" | "3days" | "week" | "month";
  remoteOnly?: boolean;
  employmentTypes?: string;
  radius?: number;
}

const JSearchResponseSchema = z.object({
  status: z.string(),
  request_id: z.string(),
  data: z.array(z.unknown()),
});

export async function searchJSearch(
  params: JSearchParams
): Promise<{ jobs: UnifiedJob[]; total: number }> {
  const { JSEARCH_API_KEY } = getEnv();

  const url = new URL("https://api.openwebninja.com/jsearch/search");
  url.searchParams.set("query", params.query);
  url.searchParams.set("page", String(params.page || 1));
  url.searchParams.set("num_pages", String(params.numPages || 1));
  url.searchParams.set("country", params.country || "ca");

  if (params.datePosted) {
    url.searchParams.set("date_posted", params.datePosted);
  }
  if (params.remoteOnly !== undefined) {
    url.searchParams.set("work_from_home", String(params.remoteOnly));
  }
  if (params.employmentTypes) {
    url.searchParams.set("employment_types", params.employmentTypes);
  }
  if (params.radius !== undefined) {
    url.searchParams.set("radius", String(params.radius));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": JSEARCH_API_KEY,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `JSearch API error: ${response.status} ${response.statusText}`
      );
    }

    const data = JSearchResponseSchema.parse(await response.json());

    const jobs: UnifiedJob[] = [];
    for (const rawJob of data.data) {
      const parsed = JSearchJobSchema.safeParse(rawJob);
      if (parsed.success) {
        jobs.push(normalizeJSearchJob(parsed.data));
      }
    }

    return { jobs, total: data.data.length };
  } finally {
    clearTimeout(timeout);
  }
}
