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
  // If Firecrawl is available, use it for deeper content analysis
  if (process.env.FIRECRAWL_API_KEY) {
    return checkWithFirecrawl(url);
  }

  // Fallback: simple HTTP check (no credits needed)
  return checkWithHttp(url);
}

async function checkWithHttp(url: string): Promise<JobActiveCheck> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobPilot/1.0)",
      },
    });

    clearTimeout(timeout);

    if (response.status >= 400) {
      return { active: false, reason: `HTTP ${response.status} — page not found or removed` };
    }

    // Read a small portion of the body to check for closed indicators
    const text = await response.text();
    const lower = text.toLowerCase();

    for (const indicator of CLOSED_INDICATORS) {
      if (lower.includes(indicator)) {
        return { active: false, reason: `Page contains "${indicator}"` };
      }
    }

    return { active: true, reason: "Job posting appears still active" };
  } catch (err) {
    return { active: true, reason: `Could not verify: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function checkWithFirecrawl(url: string): Promise<JobActiveCheck> {
  try {
    const { getFirecrawlClient } = await import("@/lib/api/firecrawl");
    const client = getFirecrawlClient();

    const doc = await client.scrape(url, {
      formats: ["markdown"],
      timeout: 15000,
    });

    const statusCode = doc.metadata?.statusCode;

    if (statusCode && statusCode >= 400) {
      return { active: false, reason: `HTTP ${statusCode} — page not found or removed` };
    }

    const content = (doc.markdown || "").toLowerCase();
    for (const indicator of CLOSED_INDICATORS) {
      if (content.includes(indicator)) {
        return { active: false, reason: `Page contains "${indicator}"` };
      }
    }

    return { active: true, reason: "Job posting appears still active" };
  } catch (err) {
    return { active: true, reason: `Could not verify: ${err instanceof Error ? err.message : String(err)}` };
  }
}
