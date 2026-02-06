import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

export async function POST() {
  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[API] Logout error:", error.message);
      return NextResponse.json({ error: "Logout failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Logout failed";
    console.error("[API] POST /api/auth/logout error:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
