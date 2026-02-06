import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, context: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const message =
    error instanceof Error ? error.message : "Unknown error";

  // Return 401 for auth errors
  if (message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Log full error server-side, return generic message to client
  console.error(`[API] ${context}:`, message);

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
