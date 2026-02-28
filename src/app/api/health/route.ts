import { createAuthClient } from "@/lib/supabase/auth-server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createAuthClient();
    await supabase.from("job_listings").select("id").limit(1);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
