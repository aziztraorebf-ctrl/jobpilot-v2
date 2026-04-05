import { getFirecrawlClient } from "@/lib/api/firecrawl";

export interface JobActiveCheck {
  active: boolean;
  reason: string;
}

const CLOSED_INDICATORS = [
  "position has been filled",
  "poste pourvu",
  "poste comble",
  "no longer accepting",
  "this job has expired",
  "cette offre a expire",
  "offre expiree",
  "job is closed",
  "posting has been removed",
  "page not found",
  "404",
  "this position is no longer available",
  "ce poste n'est plus disponible",
];

export async function checkJobStillActive(url: string): Promise<JobActiveCheck> {
  const client = getFirecrawlClient();

  try {
    const doc = await client.scrape(url, {
      formats: ["markdown"],
      timeout: 15000,
    });

    const statusCode = doc.metadata?.statusCode;

    // HTTP 404 or similar
    if (statusCode && statusCode >= 400) {
      return { active: false, reason: `HTTP ${statusCode} — page not found or removed` };
    }

    // Check content for closed indicators
    const content = (doc.markdown || "").toLowerCase();
    for (const indicator of CLOSED_INDICATORS) {
      if (content.includes(indicator)) {
        return { active: false, reason: `Page contains "${indicator}"` };
      }
    }

    // If page loads and no closed indicators, assume still active
    return { active: true, reason: "Job posting appears still active" };
  } catch (err) {
    // If scrape fails entirely (timeout, DNS error), we can't determine
    return { active: true, reason: `Could not verify: ${err instanceof Error ? err.message : String(err)}` };
  }
}
