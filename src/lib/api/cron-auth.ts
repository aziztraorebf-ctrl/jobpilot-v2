import { NextResponse } from "next/server";

/**
 * Verify that the incoming request carries the correct CRON_SECRET Bearer token.
 */
export function verifyCronSecret(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;

  const token = header.replace(/^Bearer\s+/i, "").trim();
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron-auth] CRON_SECRET env var is not set");
    return false;
  }

  return token === secret;
}

/**
 * Standard 401 response for unauthorized cron requests.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
