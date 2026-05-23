import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  const dsnPrefix = dsn ? dsn.substring(0, 30) : "MISSING";

  try {
    throw new Error("Sentry explicit capture test v2 — intentional error");
  } catch (err) {
    const eventId = Sentry.captureException(err);
    const flushed = await Sentry.flush(5000);
    return NextResponse.json({ captured: true, flushed, eventId, dsnPrefix });
  }
}
