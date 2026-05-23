import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  throw new Error("Sentry source map test — intentional error");
  return NextResponse.json({ ok: true });
}
