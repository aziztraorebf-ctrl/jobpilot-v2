import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/fr/dashboard";

  // Validate: only allow relative paths (prevent open redirect)
  const isRelativePath = next.startsWith("/") && !next.startsWith("//");
  const safeNext = isRelativePath ? next : "/fr/dashboard";

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/fr/login", origin));
}
