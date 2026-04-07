import { tavily } from "@tavily/core";

let client: ReturnType<typeof tavily> | null = null;

export function isTavilyAvailable(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export function getTavilyClient() {
  if (!client) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY is not set");
    client = tavily({ apiKey });
  }
  return client;
}
