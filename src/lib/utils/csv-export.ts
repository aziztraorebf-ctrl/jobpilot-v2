interface ApplicationForExport {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  job_listings: {
    title: string;
    company_name: string | null;
    location: string | null;
    source_url: string;
    remote_type: string;
    description: string | null;
  } | null;
}

const HEADERS = [
  "Titre",
  "Entreprise",
  "Localisation",
  "Statut",
  "Type",
  "URL",
  "Date candidature",
  "Derniere MAJ",
  "Notes",
];

function escapeCsvValue(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().split("T")[0];
  } catch {
    return iso;
  }
}

export interface JobForExport {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  source_url: string;
  remote_type: string | null;
  description: string | null;
  fetched_at: string;
  score: number;
  profile_label: string | null;
}

const JOB_HEADERS = [
  "Titre",
  "Entreprise",
  "Localisation",
  "Type",
  "Score",
  "Profil",
  "URL",
  "Date ajout",
  "Description",
];

export function generateJobsCsv(jobs: JobForExport[]): string {
  const lines: string[] = [JOB_HEADERS.join(",")];

  for (const job of jobs) {
    const row = [
      escapeCsvValue(job.title),
      escapeCsvValue(job.company_name),
      escapeCsvValue(job.location),
      escapeCsvValue(job.remote_type),
      escapeCsvValue(String(job.score)),
      escapeCsvValue(job.profile_label),
      escapeCsvValue(job.source_url),
      escapeCsvValue(formatDate(job.fetched_at)),
      escapeCsvValue(job.description),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\r\n");
}

export function generateApplicationsCsv(
  applications: ApplicationForExport[]
): string {
  const lines: string[] = [HEADERS.join(",")];

  for (const app of applications) {
    const job = app.job_listings;
    if (!job) continue;
    const row = [
      escapeCsvValue(job.title),
      escapeCsvValue(job.company_name),
      escapeCsvValue(job.location),
      escapeCsvValue(app.status),
      escapeCsvValue(job.remote_type),
      escapeCsvValue(job.source_url),
      escapeCsvValue(formatDate(app.created_at)),
      escapeCsvValue(formatDate(app.updated_at)),
      escapeCsvValue(app.notes),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}
