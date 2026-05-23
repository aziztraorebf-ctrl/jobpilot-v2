import * as Sentry from "@sentry/nextjs";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  const dsnPrefix = dsn ? dsn.substring(0, 30) : "MISSING";

  let eventId: string | undefined;
  try {
    throw new Error("Sentry waitUntil flush test — intentional error");
  } catch (err) {
    eventId = Sentry.captureException(err);
  }

  waitUntil(Sentry.flush(5000));

  return NextResponse.json({ captured: true, eventId, dsnPrefix });
}
