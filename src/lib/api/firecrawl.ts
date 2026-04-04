import Firecrawl from "@mendable/firecrawl-js";

let client: Firecrawl | null = null;

export function getFirecrawlClient(): Firecrawl {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set");
    }
    client = new Firecrawl({ apiKey });
  }
  return client;
}

export async function extractPdfTextFromUrl(pdfUrl: string): Promise<string> {
  const fc = getFirecrawlClient();
  const doc = await fc.scrape(pdfUrl, {
    formats: ["markdown"],
    parsers: ["pdf"],
  });

  return doc.markdown || "";
}
