import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().startsWith("sk-"),
  JSEARCH_API_KEY: z.string().min(1),
  ADZUNA_APP_ID: z.string().min(1),
  ADZUNA_APP_KEY: z.string().min(1),
  ADZUNA_COUNTRY: z.string().length(2).default("ca"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/** Reset cached env. Used in tests to allow re-parsing after vi.stubEnv. */
export function resetEnv(): void {
  _env = null;
}

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${missing}`);
  }

  _env = result.data;
  return _env;
}
