import * as Sentry from "@sentry/nextjs";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dsnServer = process.env.SENTRY_DSN;
  const dsnPublic = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const dsnUsed = dsnServer ?? dsnPublic;
  const dsnPrefix = dsnUsed ? dsnUsed.substring(0, 40) : "MISSING";
  const dsnServerPresent = !!dsnServer;
  const dsnPublicPresent = !!dsnPublic;

  let eventId: string | undefined;
  try {
    throw new Error("Sentry waitUntil flush test — intentional error");
  } catch (err) {
    eventId = Sentry.captureException(err);
  }

  waitUntil(Sentry.flush(5000));

  return NextResponse.json({ captured: true, eventId, dsnPrefix, dsnServerPresent, dsnPublicPresent });
}
