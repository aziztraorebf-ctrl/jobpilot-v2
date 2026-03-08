import type { JobForExport } from "./csv-export";

export function generateJobsJson(jobs: JobForExport[]): string {
  const sorted = [...jobs].sort((a, b) => b.score - a.score);

  const offres = sorted.map((job) => ({
    titre: job.title,
    entreprise: job.company_name ?? null,
    localisation: job.location ?? null,
    type: job.remote_type ?? null,
    score: job.score,
    profil: job.profile_label ?? null,
    url: job.source_url,
    date_ajout: job.fetched_at.split("T")[0],
    description: job.description ?? null,
  }));

  return JSON.stringify(
    {
      meta: {
        total: offres.length,
        exporte_le: new Date().toISOString().split("T")[0],
        score_minimum: offres.length > 0 ? Math.min(...offres.map((o) => o.score)) : null,
        score_maximum: offres.length > 0 ? Math.max(...offres.map((o) => o.score)) : null,
      },
      offres,
    },
    null,
    2
  );
}
