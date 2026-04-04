import { z } from "zod";
import { createHash } from "crypto";

// --- Adzuna API response schema ---
export const AdzunaJobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  company: z
    .object({ display_name: z.string() })
    .nullish(),
  location: z
    .object({
      display_name: z.string(),
      area: z.array(z.string()).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  salary_is_predicted: z
    .union([z.number(), z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === "string") return v === "1" || v === "true";
      return Boolean(v);
    })
    .nullish(),
  description: z.string().nullish(),
  redirect_url: z.url(),
  created: z.string().nullish(),
  category: z
    .object({
      label: z.string(),
      tag: z.string().optional(),
    })
    .nullish(),
  contract_type: z.string().nullish(),
  contract_time: z.string().nullish(),
});

export type AdzunaJob = z.infer<typeof AdzunaJobSchema>;

// --- Unified job type ---
export const UnifiedJobSchema = z.object({
  source: z.enum(["jooble", "adzuna", "jsearch", "firecrawl", "manual"]),
  source_id: z.string().nullable(),
  source_url: z.url(),
  dedup_hash: z.string(),
  title: z.string(),
  company_name: z.string().nullable(),
  location: z.string().nullable(),
  location_lat: z.number().nullable(),
  location_lng: z.number().nullable(),
  description: z.string().nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string().default("CAD"),
  salary_is_predicted: z.boolean().default(false),
  job_type: z.string().nullable(),
  category: z.string().nullable(),
  contract_type: z.string().nullable(),
  remote_type: z
    .enum(["onsite", "hybrid", "remote", "unknown"])
    .default("unknown"),
  posted_at: z.string().nullable(),
  profile_label: z.string().nullable().optional(),
  raw_data: z.unknown(),
});

export type UnifiedJob = z.infer<typeof UnifiedJobSchema>;

// --- Dedup hash ---
function normalize(s: string | null | undefined): string {
  return (s || "unknown").toLowerCase().trim().replace(/\s+/g, " ");
}

export function computeDedupHash(
  title: string,
  company: string | null,
  location: string | null
): string {
  const input = [
    normalize(title),
    normalize(company),
    normalize(location),
  ].join("|");
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

// --- Normalizers ---
function detectRemoteType(
  title: string,
  description: string | null
): "onsite" | "hybrid" | "remote" | "unknown" {
  const text = `${title} ${description || ""}`.toLowerCase();
  if (
    text.includes("remote") ||
    text.includes("teletravail") ||
    text.includes("a distance")
  ) {
    return "remote";
  }
  if (text.includes("hybrid") || text.includes("hybride")) {
    return "hybrid";
  }
  return "unknown";
}

// --- JSearch API response schema ---
export const JSearchJobSchema = z.object({
  job_id: z.string(),
  job_title: z.string().min(1),
  employer_name: z.string().nullish().default(null),
  employer_logo: z.string().nullish().default(null),
  employer_website: z.string().nullish().default(null),
  job_publisher: z.string().nullish().default(null),
  job_employment_type: z.string().nullish().default(null),
  job_employment_types: z.array(z.string()).nullish().default(null),
  job_apply_link: z.url(),
  job_apply_is_direct: z.boolean().nullish().default(null),
  job_description: z.string().nullish().default(null),
  job_is_remote: z.boolean().nullish().default(null),
  job_posted_at: z.string().nullish().default(null),
  job_posted_at_timestamp: z.number().nullish().default(null),
  job_posted_at_datetime_utc: z.string().nullish().default(null),
  job_city: z.string().nullish().default(null),
  job_state: z.string().nullish().default(null),
  job_country: z.string().nullish().default(null),
  job_latitude: z.number().nullish().default(null),
  job_longitude: z.number().nullish().default(null),
  job_min_salary: z.number().nullish().default(null),
  job_max_salary: z.number().nullish().default(null),
  job_salary_currency: z.string().nullish().default(null),
  job_salary_period: z.string().nullish().default(null),
});

export type JSearchJob = z.infer<typeof JSearchJobSchema>;

export function normalizeJSearchJob(raw: JSearchJob): UnifiedJob {
  const locationParts = [raw.job_city, raw.job_state, raw.job_country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : null;
  const hash = computeDedupHash(raw.job_title, raw.employer_name ?? null, locationStr);

  let remoteType: "onsite" | "hybrid" | "remote" | "unknown" = "unknown";
  if (raw.job_is_remote === true) {
    remoteType = "remote";
  } else {
    remoteType = detectRemoteType(raw.job_title, raw.job_description ?? null);
  }

  return {
    source: "jsearch",
    source_id: raw.job_id,
    source_url: raw.job_apply_link,
    dedup_hash: hash,
    title: raw.job_title,
    company_name: raw.employer_name ?? null,
    location: locationStr,
    location_lat: raw.job_latitude ?? null,
    location_lng: raw.job_longitude ?? null,
    description: raw.job_description ?? null,
    salary_min: raw.job_min_salary ?? null,
    salary_max: raw.job_max_salary ?? null,
    salary_currency: raw.job_salary_currency ?? "CAD",
    salary_is_predicted: false,
    job_type: raw.job_employment_type ?? null,
    category: null,
    contract_type: null,
    remote_type: remoteType,
    posted_at: raw.job_posted_at_datetime_utc ?? raw.job_posted_at ?? null,
    raw_data: raw,
  };
}

export function normalizeAdzunaJob(raw: AdzunaJob): UnifiedJob {
  const companyName = raw.company?.display_name ?? null;
  const locationName = raw.location?.display_name ?? null;
  const hash = computeDedupHash(raw.title, companyName, locationName);
  return {
    source: "adzuna",
    source_id: String(raw.id),
    source_url: raw.redirect_url,
    dedup_hash: hash,
    title: raw.title,
    company_name: companyName,
    location: locationName,
    location_lat: raw.location?.latitude ?? null,
    location_lng: raw.location?.longitude ?? null,
    description: raw.description ?? null,
    salary_min: raw.salary_min ?? null,
    salary_max: raw.salary_max ?? null,
    salary_currency: "CAD",
    salary_is_predicted: Boolean(raw.salary_is_predicted),
    job_type: raw.contract_time ?? null,
    category: raw.category?.label ?? null,
    contract_type: raw.contract_type ?? null,
    remote_type: detectRemoteType(raw.title, raw.description ?? null),
    posted_at: raw.created ?? null,
    raw_data: raw,
  };
}
