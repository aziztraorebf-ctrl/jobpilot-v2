import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

  try {
    throw new Error("Sentry explicit capture test — intentional error");
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return NextResponse.json({ captured: true, dsn_present: !!dsn });
  }
}
