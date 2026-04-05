import { NextResponse } from "next/server";
import { z } from "zod";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { upsertJobs } from "@/lib/supabase/queries";
import { requireUser } from "@/lib/supabase/get-user";
import { apiError } from "@/lib/api/error-response";

const SearchBodySchema = z.object({
  query: z.string().min(1, "query is required"),
  page: z.number().int().min(1).default(1),
  location: z.string().min(1).default("Canada"),
  sources: z
    .array(z.enum(["jsearch", "adzuna"]))
    .min(1, "At least one source is required")
    .default(["jsearch", "adzuna"]),
  remoteOnly: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    await requireUser();

    const raw = await request.json();
    const body = SearchBodySchema.parse(raw);

    const searchResult = await aggregateJobSearch({
      keywords: body.remoteOnly ? `${body.query} remote` : body.query,
      location: body.location,
      page: body.page,
      sources: body.sources,
    });

    let inserted = 0;
    if (searchResult.jobs.length > 0) {
      const rows = await upsertJobs(searchResult.jobs);
      inserted = rows.length;
    }

    return NextResponse.json({
      jobs: searchResult.jobs,
      totalJSearch: searchResult.totalJSearch,
      totalAdzuna: searchResult.totalAdzuna,
      totalFirecrawl: searchResult.totalFirecrawl,
      errors: searchResult.errors,
      inserted,
    });
  } catch (error: unknown) {
    return apiError(error, "POST /api/jobs/search");
  }
}
