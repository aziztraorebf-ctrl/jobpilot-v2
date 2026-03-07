import { createAuthClient } from "./auth-server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export async function getUser(): Promise<User | null> {
  const supabase = await createAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/fr/login");
  return user;
}
