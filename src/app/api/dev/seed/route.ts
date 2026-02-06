import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/supabase/seed";

export async function POST() {
  // Hard guard: never run in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed endpoint is disabled in production" },
      { status: 403 }
    );
  }

  try {
    const result = await seedDatabase();

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      inserted: result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown seed error";
    console.error("[API] POST /api/dev/seed error:", message);

    return NextResponse.json(
      { error: "Seed failed" },
      { status: 500 }
    );
  }
}
