import type { UnifiedJob } from "@/lib/schemas/job";

const SOURCE_PRIORITY: Record<string, number> = {
  adzuna: 2,
  jooble: 1,
  manual: 3,
};

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
    const existing = seen.get(job.dedup_hash);
    if (!existing || dataRichness(job) > dataRichness(existing)) {
      seen.set(job.dedup_hash, job);
    }
  }

  const orderedHashes: string[] = [];
  const hashSet = new Set<string>();
  for (const job of jobs) {
    if (!hashSet.has(job.dedup_hash)) {
      orderedHashes.push(job.dedup_hash);
      hashSet.add(job.dedup_hash);
    }
  }

  return orderedHashes.map((hash) => seen.get(hash)!);
}
