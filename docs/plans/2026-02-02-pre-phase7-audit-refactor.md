# Pre-Phase 7 Audit & Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corriger toutes les lacunes techniques identifiees par l'audit complet (securite, qualite, architecture, nettoyage) avant de lancer Phase 7.

**Architecture:** Corrections en 4 lots prioritaires (P0 Securite, P1 Architecture, P2 Qualite, P3 Nettoyage) avec build+test entre chaque lot.

**Tech Stack:** Next.js 16, Supabase, TypeScript strict, Zod, Vitest

---

## Diagnostic Consolide (4 audits)

### Chiffres cles

| Audit | Critique | Important | Mineur | Total |
|-------|----------|-----------|--------|-------|
| Securite | 4 | 8 | 1 | 13 |
| Qualite code | 18 | 42 | 44 | 104 |
| Nettoyage repo | 2 | 4 | 2 | 8 |
| Architecture | 4 | 6 | 21 | 31 |
| **Total** | **28** | **60** | **68** | **156** |

### Top 10 Problemes (par impact)

| # | Probleme | Severite | Source |
|---|----------|----------|--------|
| 1 | IDOR: `updateApplicationStatus()`, `deleteApplication()`, `getApplicationById()` sans filtre `user_id` | CRITIQUE | Securite |
| 2 | `/api/jobs/search` sans authentification | CRITIQUE | Securite |
| 3 | Open redirect dans `/auth/callback` (`next` param non valide) | CRITIQUE | Securite |
| 4 | `deleteResume()` sans filtre `user_id` | CRITIQUE | Securite |
| 5 | Middleware laisse passer tous les `/api/*` sans auth | IMPORTANT | Securite |
| 6 | Pas de rate limiting sur routes AI (cout OpenAI non controle) | IMPORTANT | Architecture |
| 7 | Token usage jamais persiste malgre schema DB existant | IMPORTANT | Architecture |
| 8 | Error handling duplique dans 12 routes (~200 lignes) | IMPORTANT | Qualite |
| 9 | `as unknown as` type assertions (2 occurrences critiques) | IMPORTANT | Qualite |
| 10 | Pas de `error.tsx` error boundaries (Next.js best practice) | IMPORTANT | Architecture |

---

## Lot A : Securite (P0 - BLOQUANT)

### Task 1: Ajouter `user_id` a `getApplicationById()`, `updateApplicationStatus()`, `deleteApplication()`

**Files:**
- Modify: `src/lib/supabase/queries/applications.ts:100-233`
- Modify: `src/app/api/applications/[id]/route.ts`
- Modify: `src/lib/supabase/queries/__tests__/applications.test.ts`

**Step 1: Modifier les signatures pour accepter `userId`**

```typescript
// applications.ts - getApplicationById
export async function getApplicationById(
  userId: string,
  id: string
): Promise<ApplicationWithJob> {
  if (!id) {
    throw new Error("Application ID is required");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_WITH_JOB_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch application: ${error.message}`);
  }

  return data as unknown as ApplicationWithJob;
}

// applications.ts - updateApplicationStatus
export async function updateApplicationStatus(
  userId: string,
  id: string,
  status: ApplicationRow["status"],
  extra?: {
    interview_at?: string;
    notes?: string;
    salary_offered?: number;
  }
): Promise<ApplicationRow> {
  // ... existing validation ...

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update application status: ${error.message}`);
  }

  return data;
}

// applications.ts - deleteApplication
export async function deleteApplication(userId: string, id: string): Promise<void> {
  if (!id) {
    throw new Error("Application ID is required");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete application: ${error.message}`);
  }
}
```

**Step 2: Mettre a jour la route API pour passer `userId`**

```typescript
// src/app/api/applications/[id]/route.ts
import { requireUser } from "@/lib/supabase/auth-server";

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    // ... rest with userId passed to updateApplicationStatus(userId, id, status, extra)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    await deleteApplication(userId, id);
    // ...
  }
}
```

**Step 3: Mettre a jour les tests unitaires**

Tous les appels a `updateApplicationStatus`, `deleteApplication`, `getApplicationById` doivent passer un `userId` en premier argument. Ajouter des tests IDOR (verifier qu'un userId different ne retourne rien).

**Step 4: Run tests**

Run: `npm run test:run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/lib/supabase/queries/applications.ts src/app/api/applications/[id]/route.ts src/lib/supabase/queries/__tests__/applications.test.ts
git commit -m "fix(security): add user_id filter to application CRUD (IDOR fix)"
```

---

### Task 2: Ajouter `user_id` a `deleteResume()`

**Files:**
- Modify: `src/lib/supabase/queries/resumes.ts:141-148`
- Modify: `src/app/api/resumes/[id]/route.ts`
- Modify: `src/lib/supabase/queries/__tests__/resumes.test.ts`

**Step 1: Modifier la signature**

```typescript
// resumes.ts
export async function deleteResume(userId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete resume: ${error.message}`);
  }
}
```

**Step 2: Mettre a jour la route API**

La route `/api/resumes/[id]` doit passer `userId` a `deleteResume(userId, id)`.

**Step 3: Mettre a jour les tests**

**Step 4: Run tests**

Run: `npm run test:run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/lib/supabase/queries/resumes.ts src/app/api/resumes/[id]/route.ts src/lib/supabase/queries/__tests__/resumes.test.ts
git commit -m "fix(security): add user_id filter to deleteResume (IDOR fix)"
```

---

### Task 3: Ajouter auth a `/api/jobs/search`

**Files:**
- Modify: `src/app/api/jobs/search/route.ts`

**Step 1: Ajouter `requireUser()` au debut de POST**

```typescript
import { requireUser } from "@/lib/supabase/auth-server";

export async function POST(request: Request) {
  try {
    await requireUser();  // Deny unauthenticated requests

    const raw = await request.json();
    const body = SearchBodySchema.parse(raw);
    // ... rest unchanged
  }
}
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/app/api/jobs/search/route.ts
git commit -m "fix(security): require auth on /api/jobs/search"
```

---

### Task 4: Corriger l'open redirect dans `/auth/callback`

**Files:**
- Modify: `src/app/auth/callback/route.ts`

**Step 1: Valider le parametre `next`**

```typescript
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
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "fix(security): validate redirect URL in auth callback (open redirect fix)"
```

---

### Task 5: Securiser `/api/dev/seed`

**Files:**
- Modify: `src/app/api/dev/seed/route.ts`

**Step 1: Ajouter garde environnement**

```typescript
export async function POST(request: Request) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  // ... rest unchanged
}
```

**Step 2: Commit**

```bash
git add src/app/api/dev/seed/route.ts
git commit -m "fix(security): block /api/dev/seed in production"
```

---

### Task 6: Masquer les details d'erreur internes dans les reponses API

**Files:**
- Create: `src/lib/api/error-response.ts`
- Modify: Toutes les 12 routes API

**Step 1: Creer l'utilitaire d'erreur**

```typescript
// src/lib/api/error-response.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, context: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  // Log full error server-side, return generic message to client
  const message =
    error instanceof Error ? error.message : "Unknown error";
  console.error(`[API] ${context}:`, message);

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

**Step 2: Remplacer les catch blocks dans les 12 routes**

Chaque route remplace son catch block par :
```typescript
catch (error: unknown) {
  return apiError(error, "POST /api/jobs/search");
}
```

**Step 3: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 4: Commit**

```bash
git add src/lib/api/error-response.ts src/app/api/
git commit -m "fix(security): centralize error handling, hide internal details from clients"
```

---

## Lot B : Architecture (P1)

### Task 7: Ajouter security headers dans `next.config.ts`

**Files:**
- Modify: `next.config.ts`

**Step 1: Ajouter les headers**

```typescript
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add security headers (X-Frame-Options, CSP, etc.)"
```

---

### Task 8: Ajouter rate limiting basique sur les routes AI

**Files:**
- Create: `src/lib/api/rate-limiter.ts`
- Modify: `src/app/api/ai/analyze-cv/route.ts`
- Modify: `src/app/api/ai/match-score/route.ts`
- Modify: `src/app/api/ai/cover-letter/route.ts`

**Step 1: Creer un rate limiter in-memory simple**

```typescript
// src/lib/api/rate-limiter.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Simple in-memory rate limiter.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}
```

**Step 2: Appliquer aux 3 routes AI**

Ajouter en debut de chaque route POST :

```typescript
import { checkRateLimit } from "@/lib/api/rate-limiter";

// Inside POST handler, after requireUser():
const limit = checkRateLimit(`ai:${userId}`, 20, 60 * 60 * 1000); // 20 req/h
if (!limit.allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again later." },
    { status: 429 }
  );
}
```

**Step 3: Run build**

Run: `npm run build`
Expected: Build passes

**Step 4: Commit**

```bash
git add src/lib/api/rate-limiter.ts src/app/api/ai/
git commit -m "feat(security): add rate limiting on AI routes (20 req/h per user)"
```

---

### Task 9: Ajouter `error.tsx` error boundaries

**Files:**
- Create: `src/app/[locale]/(app)/error.tsx`
- Create: `src/app/[locale]/(auth)/error.tsx`
- Create: `src/app/global-error.tsx`

**Step 1: Creer le error boundary app**

```typescript
// src/app/[locale]/(app)/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">
        {error.digest ? `Error ID: ${error.digest}` : "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
```

**Step 2: Creer le global error boundary**

```typescript
// src/app/global-error.tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

**Step 3: Run build**

Run: `npm run build`
Expected: Build passes

**Step 4: Commit**

```bash
git add src/app/
git commit -m "feat(ux): add error.tsx boundaries for graceful error handling"
```

---

### Task 10: Valider les variables d'environnement au boot

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/auth-server.ts`
- Modify: `src/lib/api/jsearch.ts`
- Modify: `src/lib/api/adzuna.ts`
- Modify: `src/lib/services/openai-client.ts`

**Step 1: Creer le module de validation env**

```typescript
// src/lib/env.ts
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
```

**Step 2: Remplacer les `process.env` directs dans les clients**

Dans `client.ts`, `auth-server.ts`, `jsearch.ts`, `adzuna.ts`, `openai-client.ts` :
```typescript
import { getEnv } from "@/lib/env";

// Replace: const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// With:    const { NEXT_PUBLIC_SUPABASE_URL: url } = getEnv();
```

**Step 3: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass (tests qui mockent `process.env` devront mocker `getEnv` a la place)

**Step 4: Commit**

```bash
git add src/lib/env.ts src/lib/supabase/ src/lib/api/ src/lib/services/
git commit -m "feat(reliability): centralize env validation with Zod schema"
```

---

### Task 11: Ajouter timeouts sur les appels API externes

**Files:**
- Modify: `src/lib/api/jsearch.ts`
- Modify: `src/lib/api/adzuna.ts`
- Modify: `src/lib/services/openai-client.ts`

**Step 1: Ajouter AbortController avec timeout**

Pour chaque appel `fetch()` dans jsearch.ts et adzuna.ts :

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000); // 15s

try {
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  // ... process response
} finally {
  clearTimeout(timeout);
}
```

Pour OpenAI (SDK), ajouter `timeout` dans les options du client :

```typescript
const client = new OpenAI({
  apiKey: getEnv().OPENAI_API_KEY,
  timeout: 30000, // 30s
});
```

**Step 2: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 3: Commit**

```bash
git add src/lib/api/ src/lib/services/
git commit -m "feat(reliability): add timeouts on external API calls (15s fetch, 30s OpenAI)"
```

---

## Lot C : Qualite Code (P2)

### Task 12: Supprimer le code mort

**Files:**
- Delete: `src/lib/mock-data.ts`
- Delete: `src/lib/api/jooble.ts`
- Delete: `src/lib/api/__tests__/jooble.test.ts`
- Modify: `src/lib/supabase/queries/index.ts` (si re-export jooble)
- Modify: `src/lib/schemas/ai-responses.ts` (supprimer CvOptimizationSchema si inutilise)

**Step 1: Verifier les imports**

Run: grep pour `mock-data`, `jooble`, `CvOptimization` dans tout le codebase.

**Step 2: Supprimer les fichiers + nettoyer les imports**

**Step 3: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass (jooble tests supprimees, pas de broken imports)

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead code (mock-data, jooble client, CvOptimizationSchema)"
```

---

### Task 13: Corriger les type assertions `as unknown as`

**Files:**
- Modify: `src/lib/supabase/queries/applications.ts:93,118`

**Step 1: Typer correctement le select Supabase**

Le probleme vient du fait que Supabase ne connait pas la forme du join. Solution: caster le `data` avec un type guard ou utiliser un `.returns<ApplicationWithJob[]>()`.

```typescript
// Option: utiliser .returns<>() pour typer le retour
const { data, error } = await supabase
  .from("applications")
  .select(APPLICATION_WITH_JOB_SELECT)
  .eq("user_id", userId)
  .order("updated_at", { ascending: false })
  .returns<ApplicationWithJob[]>();
```

Si `.returns<>()` ne suffit pas, utiliser une assertion simple `as ApplicationWithJob[]` (acceptable pour un join connu) plutot que le double cast `as unknown as`.

**Step 2: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 3: Commit**

```bash
git add src/lib/supabase/queries/applications.ts
git commit -m "fix(types): replace 'as unknown as' with .returns<> in application queries"
```

---

### Task 14: Deduplicer le type `ApplicationStatus`

**Files:**
- Modifier l'endroit canonique (ex: `src/types/application.ts` ou reutiliser le schema Zod)
- Modifier: les 4 fichiers qui definissent le meme enum

**Step 1: Identifier les 4 occurrences**

Run: grep pour `APPLICATION_STATUSES` et `ApplicationStatus` dans le codebase.

**Step 2: Creer une source unique**

Soit dans le fichier queries/applications.ts (deja present), soit dans un fichier `src/types/` dedie. Exporter et importer partout.

**Step 3: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 4: Commit**

```bash
git add src/
git commit -m "refactor: deduplicate ApplicationStatus type to single source"
```

---

### Task 15: Calculer `avgScore` en SQL au lieu de en memoire

**Files:**
- Modify: `src/lib/supabase/queries/applications.ts:274-316`

**Step 1: Remplacer la requete qui fetch tous les scores par un appel RPC ou `.avg()`**

Supabase ne supporte pas `.avg()` directement. Utiliser une requete RPC ou calculer via `select("overall_score")` avec `head: false` et un COUNT en parallele.

Alternative pragmatique: garder le code actuel mais ajouter une limite (ex: `.limit(1000)`) pour eviter de charger des milliers de scores en memoire.

```typescript
// Option pragmatique: limiter + documenter
supabase
  .from("match_scores")
  .select("overall_score")
  .eq("user_id", userId)
  .limit(1000) // Safety cap - single user app won't exceed this
```

**Step 2: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 3: Commit**

```bash
git add src/lib/supabase/queries/applications.ts
git commit -m "fix(perf): add safety limit on score aggregation query"
```

---

## Lot D : Nettoyage Repo (P3)

### Task 16: Supprimer fichiers parasites + mettre a jour .gitignore

**Files:**
- Delete: `nul` (fichier a la racine)
- Delete: `tmp/` (dossier a la racine)
- Modify: `.gitignore`
- Modify: `.env.example` (ajouter `JSEARCH_API_KEY`)

**Step 1: Supprimer les fichiers**

```bash
rm nul
rm -rf tmp/
```

**Step 2: Mettre a jour .gitignore**

Ajouter :
```
# Temp files
tmp/
nul
```

**Step 3: Ajouter JSEARCH_API_KEY a .env.example**

**Step 4: Commit**

```bash
git add .gitignore .env.example
git rm nul
git rm -r tmp/ 2>/dev/null || true
git commit -m "chore: cleanup repo (remove nul/tmp, update .gitignore, fix .env.example)"
```

---

### Task 17: Supprimer dependances inutilisees

**Files:**
- Modify: `package.json`

**Step 1: Verifier que `@testing-library/jest-dom` et `@testing-library/react` ne sont pas importes**

Run: grep pour `@testing-library` dans tout le codebase.

**Step 2: Si inutilisees, desinstaller**

```bash
npm uninstall @testing-library/jest-dom @testing-library/react
```

**Step 3: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused @testing-library dependencies"
```

---

### Task 18: Rendre `dedup_hash` UNIQUE dans la DB

**Files:**
- Migration SQL via Supabase

**Step 1: Creer la migration**

```sql
-- Drop existing non-unique index
DROP INDEX IF EXISTS idx_job_listings_dedup_hash;

-- Add unique constraint (which creates a unique index)
ALTER TABLE job_listings ADD CONSTRAINT uq_job_listings_dedup_hash UNIQUE (dedup_hash);
```

**Step 2: Simplifier `upsertJobs()` pour utiliser `.upsert()` natif**

```typescript
export async function upsertJobs(jobs: UnifiedJob[]): Promise<JobRow[]> {
  if (jobs.length === 0) return [];

  const supabase = getSupabase();
  const rows = jobs.map(mapUnifiedJobToInsert);

  const { data, error } = await supabase
    .from("job_listings")
    .upsert(rows, { onConflict: "dedup_hash", ignoreDuplicates: true })
    .select();

  if (error) {
    throw new Error(`Failed to upsert jobs: ${error.message}`);
  }

  return data ?? [];
}
```

**Step 3: Mettre a jour les tests**

**Step 4: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: All pass

**Step 5: Commit**

```bash
git add src/lib/supabase/queries/jobs.ts src/lib/supabase/queries/__tests__/jobs.test.ts
git commit -m "feat(db): make dedup_hash UNIQUE, simplify upsertJobs with native upsert"
```

---

## Lot E : Verification finale

### Task 19: Build + tests complets + hostile review

**Step 1: Run full test suite**

Run: `npm run test:run`
Expected: All 139+ tests pass (minus 3 jooble tests removed)

**Step 2: Run build**

Run: `npm run build`
Expected: 0 errors, 0 warnings

**Step 3: Hostile review checklist**

- [ ] Aucun `as unknown as` restant (sauf si justifie)
- [ ] Aucune route API sans auth (sauf `/auth/callback`, `/api/auth/logout`)
- [ ] Aucun `user_id` manquant dans les queries de mutation
- [ ] `error.message` jamais expose au client
- [ ] Variables d'environnement validees par Zod
- [ ] Rate limiting en place sur routes AI
- [ ] `.gitignore` inclut `nul` et `tmp/`
- [ ] `dedup_hash` est UNIQUE

**Step 4: Commit final**

```bash
git add -A
git commit -m "chore: pre-Phase 7 audit complete - security, quality, architecture fixes"
```

---

## Problemes NON traites (documentes)

Ces items sont identifies mais hors scope du refactoring pre-Phase 7 :

| # | Probleme | Raison du report | Phase prevue |
|---|----------|------------------|--------------|
| 1 | Token usage persistence (api_usage table) | Feature, pas fix | Phase 8 |
| 2 | Pagination sur getApplications() | UX enhancement | Phase 7 |
| 3 | Client revalidation apres mutations | UX enhancement | Phase 7 |
| 4 | Server Actions au lieu de Route Handlers pour mutations | Refactor architectural | Post-MVP |
| 5 | Dashboard charge 50 jobs pour en afficher 5 | Optimisation | Phase 7 |
| 6 | Missing DB indexes (beyond dedup_hash) | Performance | Phase 8+ |
| 7 | Rate limiting sur login/signup | Securite renforcee | Phase 9 |
| 8 | Suspense boundaries | UX enhancement | Phase 7 |
| 9 | Caching/revalidation strategy | Performance | Phase 7+ |
| 10 | 28 console.error en production | Logging structure | Phase 9 |

---

## Ordre d'execution recommande

```
Lot A (Tasks 1-6) -> Build+Test -> Commit
Lot B (Tasks 7-11) -> Build+Test -> Commit
Lot C (Tasks 12-15) -> Build+Test -> Commit
Lot D (Tasks 16-18) -> Build+Test -> Commit
Lot E (Task 19) -> Verification finale -> Commit
```

**Estimation: 18 tasks, 5 lots, ~5 commits principaux**
