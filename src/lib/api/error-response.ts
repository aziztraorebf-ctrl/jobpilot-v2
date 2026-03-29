import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Known error codes that agents/clients can act on */
const KNOWN_ERROR_CODES: Record<string, { status: number; code: string }> = {
  "Unauthorized": { status: 401, code: "UNAUTHORIZED" },
  "RESUME_NOT_FOUND": { status: 404, code: "RESUME_NOT_FOUND" },
  "NO_PARSED_DATA": { status: 422, code: "NO_PARSED_DATA" },
  "MANUAL_SEARCH_LIMIT_REACHED": { status: 429, code: "RATE_LIMITED" },
  "No profiles found": { status: 404, code: "NO_PROFILES" },
  "SCORING_FAILED": { status: 502, code: "SCORING_FAILED" },
};

export function apiError(error: unknown, context: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  // Check if this is a known error with a specific code
  const known = KNOWN_ERROR_CODES[message];
  if (known) {
    return NextResponse.json(
      { error: message, code: known.code },
      { status: known.status }
    );
  }

  // Log full error server-side, return context-aware message to client
  console.error(`[API] ${context}:`, message);

  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR", context },
    { status: 500 }
  );
}
