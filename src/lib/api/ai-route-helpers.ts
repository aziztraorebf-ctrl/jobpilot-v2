import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limiter";

/**
 * Enforce AI rate limit for the given user.
 * Returns a 429 NextResponse if exceeded, or null if allowed.
 */
export function enforceAiRateLimit(userId: string): NextResponse | null {
  const limit = checkRateLimit(`ai:${userId}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }
  return null;
}

/**
 * Safely parse JSON from a request.
 * Returns { data } on success, or { error: NextResponse } on invalid JSON.
 */
export async function parseJsonBody(
  request: Request
): Promise<
  | { data: unknown; error?: undefined }
  | { data?: undefined; error: NextResponse }
> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Extract parsed CV data from a resume's parsed_data field.
 * Returns structured skills, experience, and summary.
 */
export function extractCvData(parsedData: Record<string, unknown>) {
  const skills = (parsedData.skills as {
    technical: string[];
    soft: string[];
    languages: string[];
  }) ?? { technical: [], soft: [], languages: [] };

  const experience =
    (parsedData.experience as {
      title: string;
      company: string;
      description: string;
    }[]) ?? [];

  const summary = (parsedData.summary as string) ?? "";

  return { skills, experience, summary };
}
