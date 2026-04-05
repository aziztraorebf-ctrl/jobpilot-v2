# Integration Firecrawl MCP dans JobPilot v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrer Firecrawl MCP pour resoudre BUG-2 (PDF parsing), ajouter des sources d'offres via web scraping, ameliorer la deduplication, rendre browser-apply fonctionnel, et documenter l'orchestration agent.

**Architecture:** Firecrawl MCP est deja disponible dans l'environnement Claude Code. L'integration se fait cote serveur via le SDK JS officiel `@mendable/firecrawl-js` (API v2). Le SDK supporte les schemas Zod nativement dans les options d'extraction JSON — on reutilise directement nos schemas existants. Le MCP reste utile pour le prototypage et l'usage agent interactif.

**Tech Stack:** Next.js 16, Supabase, `@mendable/firecrawl-js` (SDK v2), Zod, TypeScript

**API v2 — Points critiques:**
- Package npm: `@mendable/firecrawl-js` (PAS `firecrawl-js`)
- Methode scrape: `app.scrape(url, opts)` (PAS `scrapeUrl`)
- JSON extraction: `formats: [{ type: 'json', schema: zodSchema }]` — Zod natif
- Extract multi-URL: `app.extract({ urls, prompt, schema })`
- Search: `app.search(query, opts)` — retourne `results.data.web[]`
- Agent: `app.agent({ prompt })` — retourne `agentResult.data`
- PDF: `parsers: ["pdf"]` dans options scrape
- Interact: `firecrawl_scrape` + `firecrawl_interact(scrapeId)` — browser_* DEPRECATED

**Branch:** `feat/firecrawl-integration`

---

## Task 1: Setup — SDK Firecrawl + env vars

**Files:**
- Modify: `.env.local` (ajouter FIRECRAWL_API_KEY)
- Modify: `.env.example` (ajouter placeholder)
- Modify: `.env.production.example` (ajouter placeholder)
- Create: `src/lib/api/firecrawl.ts` (client wrapper)

**Step 1: Installer le SDK Firecrawl**

```bash
npm install @mendable/firecrawl-js
```

**Step 2: Ajouter les env vars**

Dans `.env.local`:
```
FIRECRAWL_API_KEY=fc-VOTRE_CLE
```

Dans `.env.example` et `.env.production.example`:
```
FIRECRAWL_API_KEY=
```

**Step 3: Creer le client wrapper**

```typescript
// src/lib/api/firecrawl.ts
import Firecrawl from "@mendable/firecrawl-js";

let client: Firecrawl | null = null;

export function getFirecrawlClient(): Firecrawl {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set");
    }
    client = new Firecrawl({ apiKey });
  }
  return client;
}
```

**Step 4: Commit**

```bash
git add src/lib/api/firecrawl.ts .env.example .env.production.example package.json package-lock.json
git commit -m "feat: add Firecrawl SDK and client wrapper"
```

---

## Task 2: Fix BUG-2 — PDF parsing via Firecrawl

**Files:**
- Modify: `src/app/api/ai/analyze-cv/route.ts:44-65` (remplacer unpdf par Firecrawl)
- Test: `src/app/api/ai/__tests__/analyze-cv.test.ts` (ajouter test PDF path)

**Contexte:** Actuellement le code (ligne 57-58) fait:
```typescript
const { extractText } = await import("unpdf");
const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
```
Ceci crash sur Vercel Serverless. On remplace par un appel Firecrawl qui parse le PDF cote Firecrawl (Rust parser v2).

**Step 1: Ecrire le test pour le nouveau path PDF**

Ajouter un test qui verifie que quand un resume est de type PDF sans raw_text, le code appelle Firecrawl pour extraire le texte. Mocker le client Firecrawl.

**Step 2: Run test — verifier qu'il echoue**

```bash
npx vitest run src/app/api/ai/__tests__/analyze-cv.test.ts --reporter=verbose
```

**Step 3: Creer le helper d'extraction PDF**

```typescript
// Dans src/lib/api/firecrawl.ts — ajouter:
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const client = getFirecrawlClient();

  // Firecrawl scrape supporte les PDFs via URL.
  // Pour un buffer local, on doit d'abord obtenir une URL signee Supabase.
  // Cette fonction attend une URL publique ou signee.
  throw new Error("Use extractPdfTextFromUrl instead");
}

export async function extractPdfTextFromUrl(pdfUrl: string): Promise<string> {
  const client = getFirecrawlClient();
  const result = await client.scrape(pdfUrl, {
    formats: ["markdown"],
    parsers: ["pdf"],
  });

  if (!result.success) {
    throw new Error(`Firecrawl PDF extraction failed: ${result.error || "unknown error"}`);
  }

  return result.markdown || "";
}
```

**Step 4: Modifier analyze-cv/route.ts**

Remplacer le bloc PDF (lignes 44-65) par:

```typescript
if (resume.file_type === "pdf") {
  // Get a signed URL for the PDF from Supabase Storage
  const supabase = getSupabase();
  const { data: signedData, error: signError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(resume.file_path, 300); // 5 min expiry
  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: "Could not generate signed URL for PDF." },
      { status: 500 }
    );
  }

  const { extractPdfTextFromUrl } = await import("@/lib/api/firecrawl");
  rawText = await extractPdfTextFromUrl(signedData.signedUrl);
  if (!rawText.trim()) {
    return NextResponse.json(
      { error: "Could not extract text from PDF. Try uploading a .txt version." },
      { status: 422 }
    );
  }
  // Persist extracted text so future analyses are instant
  await updateResume(user.id, resumeId, { raw_text: rawText });
}
```

**Step 5: Run tests**

```bash
npx vitest run src/app/api/ai/__tests__/analyze-cv.test.ts --reporter=verbose
```

**Step 6: Commit**

```bash
git add src/app/api/ai/analyze-cv/route.ts src/lib/api/firecrawl.ts src/app/api/ai/__tests__/analyze-cv.test.ts
git commit -m "fix(analyze-cv): replace unpdf with Firecrawl PDF parser v2 — fixes BUG-2"
```

---

## Task 3: Source Firecrawl dans le pipeline fetch — adapter + normalizer

**Files:**
- Create: `src/lib/api/firecrawl-jobs.ts` (fetcher d'offres via Firecrawl search+extract)
- Modify: `src/lib/schemas/job.ts` (ajouter "firecrawl" au source enum + normalizer)
- Modify: `src/lib/services/job-aggregator.ts` (integrer source firecrawl)
- Modify: `src/lib/services/deduplicator.ts` (ajouter firecrawl au source priority)
- Test: nouveau fichier test pour firecrawl-jobs

**Step 1: Ajouter "firecrawl" au source enum dans le schema**

Dans `src/lib/schemas/job.ts` ligne 45, modifier:
```typescript
source: z.enum(["jooble", "adzuna", "jsearch", "firecrawl", "manual"]),
```

Note: Il faudra aussi ajouter "firecrawl" dans la contrainte SQL de la table `job_listings`. Faire une migration.

**Step 2: Ecrire le schema Zod d'extraction Firecrawl**

Le SDK v2 supporte Zod nativement dans `formats: [{ type: 'json', schema: zodSchema }]`.
On definit un schema Zod dedie a l'extraction d'offres:

```typescript
// src/lib/api/firecrawl-jobs.ts
import { z } from "zod";

export const FirecrawlJobExtractSchema = z.object({
  title: z.string(),
  company_name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().nullable().optional(),
  job_type: z.string().nullable().optional(),
  contract_type: z.string().nullable().optional(),
  remote_type: z.enum(["onsite", "hybrid", "remote", "unknown"]).optional(),
  posted_at: z.string().nullable().optional(),
  application_url: z.string().nullable().optional(),
});

export type FirecrawlJobExtract = z.infer<typeof FirecrawlJobExtractSchema>;
```

**Step 3: Ecrire le fetcher Firecrawl**

```typescript
// src/lib/api/firecrawl-jobs.ts
import { getFirecrawlClient } from "./firecrawl";
import { computeDedupHash, type UnifiedJob } from "@/lib/schemas/job";

export interface FirecrawlSearchParams {
  keywords: string;
  location?: string;
  limit?: number;
}

export interface FirecrawlSearchResult {
  jobs: UnifiedJob[];
  total: number;
}

export async function searchFirecrawl(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
  const client = getFirecrawlClient();
  const query = params.location
    ? `${params.keywords} jobs in ${params.location}`
    : `${params.keywords} jobs`;

  const results = await client.search(query, {
    limit: params.limit || 10,
    scrapeOptions: {
      formats: [{ type: "json", schema: FirecrawlJobExtractSchema }],
    },
  });

  if (!results.success) {
    throw new Error(`Firecrawl search failed: ${results.error || "unknown"}`);
  }

  const webResults = results.data?.web || results.data || [];
  const jobs: UnifiedJob[] = webResults
    .filter((r: any) => r.json?.title)
    .map((r: any) => normalizeFirecrawlJob(r.json, r.url || ""));

  return { jobs, total: jobs.length };
}

export function normalizeFirecrawlJob(raw: any, sourceUrl: string): UnifiedJob {
  const title = raw.title || "Unknown";
  const company = raw.company_name || null;
  const location = raw.location || null;

  return {
    source: "firecrawl",
    source_id: null,
    source_url: raw.application_url || sourceUrl,
    dedup_hash: computeDedupHash(title, company, location),
    title,
    company_name: company,
    location,
    location_lat: null,
    location_lng: null,
    description: raw.description || null,
    salary_min: raw.salary_min ?? null,
    salary_max: raw.salary_max ?? null,
    salary_currency: raw.salary_currency || "CAD",
    salary_is_predicted: false,
    job_type: raw.job_type || null,
    category: null,
    contract_type: raw.contract_type || null,
    remote_type: raw.remote_type || "unknown",
    posted_at: raw.posted_at || null,
    raw_data: raw,
  };
}
```

**Step 4: Integrer dans job-aggregator.ts**

Modifier `AggregateSearchParams.sources` pour accepter `"firecrawl"`:

```typescript
sources?: ("jsearch" | "adzuna" | "firecrawl")[];
```

Ajouter dans `AggregateSearchResult`:
```typescript
totalFirecrawl: number;
```

Ajouter le bloc firecrawl dans `aggregateJobSearch()`:

```typescript
let firecrawlJobs: UnifiedJob[] = [];
let totalFirecrawl = 0;

if (sources.includes("firecrawl")) {
  promises.push(
    searchFirecrawl({
      keywords: params.keywords,
      location: params.location,
      limit: 10,
    })
      .then((result) => {
        firecrawlJobs = result.jobs;
        totalFirecrawl = result.total;
      })
      .catch((err) => {
        errors.push(`Firecrawl: ${err instanceof Error ? err.message : String(err)}`);
      })
  );
}

// Modifier allJobs pour inclure firecrawl:
const allJobs = [...jsearchJobs, ...adzunaJobs, ...firecrawlJobs];

return { jobs: deduplicated, totalJSearch, totalAdzuna, totalFirecrawl, errors };
```

**Step 5: Ajouter firecrawl au deduplicator priority**

Dans `src/lib/services/deduplicator.ts`, ajouter dans la source priority map:
```typescript
firecrawl: 2, // Meme priorite qu'Adzuna (donnees riches via extract)
```

**Step 6: Migration DB — ajouter "firecrawl" au CHECK constraint**

```sql
-- supabase/migrations/011_add_firecrawl_source.sql
ALTER TABLE public.job_listings
  DROP CONSTRAINT IF EXISTS job_listings_source_check;

ALTER TABLE public.job_listings
  ADD CONSTRAINT job_listings_source_check
  CHECK (source IN ('jooble', 'adzuna', 'jsearch', 'firecrawl', 'manual'));
```

**Step 7: Ecrire les tests**

Tester `normalizeFirecrawlJob` et `searchFirecrawl` (avec mock du client).

**Step 8: Run tests**

```bash
npx vitest run --reporter=verbose
```

**Step 9: Commit**

```bash
git add src/lib/api/firecrawl-jobs.ts src/lib/schemas/job.ts src/lib/services/job-aggregator.ts src/lib/services/deduplicator.ts supabase/migrations/011_add_firecrawl_source.sql
git commit -m "feat(fetch): add Firecrawl as job source with search+extract pipeline"
```

---

## Task 4: Ameliorer la deduplication

**Files:**
- Modify: `src/lib/schemas/job.ts:73-88` (ameliorer normalize + computeDedupHash)
- Test: tests existants du deduplicator

**Contexte:** Le hash actuel est `SHA256(normalize(title)|normalize(company)|normalize(location))` ou `normalize` fait juste `lowercase + trim + collapse spaces`. Le probleme: "Senior React Developer" vs "Senior React.js Developer" ou "Toronto, ON, Canada" vs "Toronto, Ontario" produisent des hashes differents.

**Step 1: Ecrire les tests de cas limites**

```typescript
// Tester que ces paires produisent le meme hash:
// "Senior React Developer" vs "Senior React.js Developer"  -> meme hash
// "Toronto, ON, Canada" vs "Toronto, Ontario, Canada" -> meme hash
// "TechCorp Inc." vs "TechCorp" -> meme hash
```

**Step 2: Run tests — verifier qu'ils echouent**

**Step 3: Ameliorer la fonction normalize**

```typescript
function normalize(s: string | null | undefined): string {
  let result = (s || "unknown").toLowerCase().trim();
  // Collapse whitespace
  result = result.replace(/\s+/g, " ");
  // Remove common suffixes (Inc., Ltd., Corp., etc.)
  result = result.replace(/\b(inc|ltd|corp|co|llc|gmbh|sa|sas|sarl)\.?\b/gi, "").trim();
  // Normalize tech terms
  result = result.replace(/\breact\.?js\b/g, "react");
  result = result.replace(/\bnode\.?js\b/g, "node");
  result = result.replace(/\bnext\.?js\b/g, "next");
  result = result.replace(/\bvue\.?js\b/g, "vue");
  result = result.replace(/\btypescript\b/g, "ts");
  // Remove punctuation except spaces
  result = result.replace(/[^a-z0-9\s]/g, "").trim();
  // Collapse whitespace again after removals
  result = result.replace(/\s+/g, " ");
  return result;
}
```

Ajouter aussi une normalisation de location (province abbreviations):

```typescript
function normalizeLocation(s: string | null | undefined): string {
  let result = normalize(s);
  // Canadian province abbreviations
  const provinces: Record<string, string> = {
    "ontario": "on", "quebec": "qc", "british columbia": "bc",
    "alberta": "ab", "manitoba": "mb", "saskatchewan": "sk",
    "nova scotia": "ns", "new brunswick": "nb",
    "newfoundland": "nl", "pei": "pe", "prince edward island": "pe",
  };
  for (const [full, abbr] of Object.entries(provinces)) {
    result = result.replace(new RegExp(`\\b${full}\\b`, "g"), abbr);
  }
  // Remove country if Canada
  result = result.replace(/\bcanada\b/g, "").trim();
  result = result.replace(/\bca\b$/, "").trim();
  return result;
}
```

Modifier `computeDedupHash` pour utiliser `normalizeLocation` sur le 3e champ.

**Step 4: Run tests — verifier qu'ils passent**

**Step 5: Commit**

```bash
git add src/lib/schemas/job.ts
git commit -m "fix(dedup): improve normalization to catch more duplicates across sources"
```

**Attention:** Cette amelioration affecte les futurs jobs seulement. Les jobs existants gardent leurs anciens hashes. Pas de migration de donnees necessaire car on a fait un reset inbox.

---

## Task 5: browser-apply v1 — reconnaissance + decision + execution

**Files:**
- Modify: `src/app/api/cowork/browser-apply/route.ts` (workflow complet)
- Create: `src/lib/services/browser-apply.ts` (logique metier separee)
- Test: nouveau fichier test

**Contexte:** L'endpoint actuel cree juste une application en status "saved". On le transforme en workflow 3 phases:
1. **Reconnaissance** — scrape l'URL de l'offre, classifie le type ATS
2. **Decision** — auto vs requires_human selon la complexite
3. **Execution** — remplir et soumettre via `firecrawl_interact`

**Important:** `firecrawl_browser_*` est DEPRECATED. Utiliser `firecrawl_scrape` + `firecrawl_interact` (via scrapeId).

**Step 1: Creer le service browser-apply**

```typescript
// src/lib/services/browser-apply.ts
import { z } from "zod";
import { getFirecrawlClient } from "@/lib/api/firecrawl";

export type AtsType = "linkedin" | "indeed" | "workday" | "greenhouse" | "lever" | "other";

export interface ReconResult {
  atsType: AtsType;
  hasSimpleForm: boolean;
  requiresAuth: boolean;
  formFields: string[];
  scrapeId: string | null;
}

// Phase 1: Reconnaissance
export async function reconApplicationPage(url: string): Promise<ReconResult> {
  const client = getFirecrawlClient();

  const ReconSchema = z.object({
    ats_system: z.string().optional(),
    has_form: z.boolean().optional(),
    requires_auth: z.boolean().optional(),
    form_fields: z.array(z.string()).optional(),
  });

  const scrapeResult = await client.scrape(url, {
    formats: [
      "markdown",
      {
        type: "json",
        schema: ReconSchema,
        prompt: "Analyze this job application page. Identify: 1) What ATS system is this (LinkedIn, Indeed, Workday, Greenhouse, Lever, or other)? 2) Is there a simple application form visible? 3) Does it require login/authentication? 4) What form fields are visible (name, email, resume upload, cover letter, etc)?",
      },
    ],
  });

  if (!scrapeResult.success) {
    throw new Error(`Recon failed: ${scrapeResult.error || "unknown"}`);
  }

  const json = scrapeResult.json || {};
  const atsType = classifyAts(json.ats_system || "", url);

  return {
    atsType,
    hasSimpleForm: Boolean(json.has_form),
    requiresAuth: Boolean(json.requires_auth),
    formFields: json.form_fields || [],
    scrapeId: scrapeResult.metadata?.scrapeId || null,
  };
}

function classifyAts(detected: string, url: string): AtsType {
  const lower = detected.toLowerCase();
  const urlLower = url.toLowerCase();

  if (lower.includes("linkedin") || urlLower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("indeed") || urlLower.includes("indeed.com")) return "indeed";
  if (lower.includes("workday") || urlLower.includes("myworkday")) return "workday";
  if (lower.includes("greenhouse") || urlLower.includes("greenhouse.io")) return "greenhouse";
  if (lower.includes("lever") || urlLower.includes("lever.co")) return "lever";
  return "other";
}

// Phase 2: Decision
export interface ApplyDecision {
  canAutomate: boolean;
  reason: string;
}

export function decideApplyStrategy(recon: ReconResult): ApplyDecision {
  // LinkedIn/Indeed always require auth + complex flows
  if (recon.atsType === "linkedin" || recon.atsType === "indeed") {
    return { canAutomate: false, reason: `${recon.atsType} requires authentication and complex multi-step flow` };
  }

  if (recon.requiresAuth) {
    return { canAutomate: false, reason: "Application page requires authentication" };
  }

  if (!recon.hasSimpleForm) {
    return { canAutomate: false, reason: "No simple application form detected" };
  }

  // Workday is notoriously complex
  if (recon.atsType === "workday") {
    return { canAutomate: false, reason: "Workday forms are multi-step and require authentication" };
  }

  return { canAutomate: true, reason: "Simple form detected, no auth required" };
}

// Phase 3: Execution
export interface ApplyResult {
  success: boolean;
  message: string;
}

export async function executeApplication(
  scrapeId: string,
  profile: { name: string; email: string; phone?: string },
): Promise<ApplyResult> {
  const client = getFirecrawlClient();

  try {
    const result = await client.interact(scrapeId, {
      prompt: `Fill out this job application form with the following information:
- Full Name: ${profile.name}
- Email: ${profile.email}
${profile.phone ? `- Phone: ${profile.phone}` : ""}
After filling the form, click the Submit/Apply button.`,
      timeout: 60,
    });

    if (!result.success) {
      return { success: false, message: `Interact failed: ${result.error || "unknown"}` };
    }

    return { success: true, message: "Application submitted via form automation" };
  } catch (err) {
    return {
      success: false,
      message: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

**Step 2: Modifier browser-apply/route.ts pour le workflow complet**

```typescript
// src/app/api/cowork/browser-apply/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyCronSecret, unauthorizedResponse } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/error-response";
import {
  createApplication,
  getJobById,
  getProfilesWithAutoSearch,
  updateAgentStatus,
} from "@/lib/supabase/queries";
import {
  reconApplicationPage,
  decideApplyStrategy,
  executeApplication,
} from "@/lib/services/browser-apply";

const BodySchema = z.object({
  job_listing_id: z.string().uuid(),
  application_url: z.string().url(),
  resume_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse();
  }

  try {
    const raw = await request.json();
    const body = BodySchema.parse(raw);

    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ error: "No profiles found" }, { status: 404 });
    }
    const userId = profiles[0].id;
    const job = await getJobById(body.job_listing_id);

    // Create the application
    const application = await createApplication(userId, body.job_listing_id);

    // Phase 1: Reconnaissance
    let recon;
    try {
      recon = await reconApplicationPage(body.application_url);
      // Update ats_type
      await updateAgentStatus(application.id, "pending", null);
      // TODO: updateAtsType if query exists, or include in agent_notes
    } catch (err) {
      await updateAgentStatus(application.id, "failed",
        `Recon failed: ${err instanceof Error ? err.message : String(err)}`);
      return NextResponse.json({
        status: "failed",
        phase: "reconnaissance",
        applicationId: application.id,
        error: err instanceof Error ? err.message : String(err),
      }, { status: 200 });
    }

    // Phase 2: Decision
    const decision = decideApplyStrategy(recon);

    if (!decision.canAutomate) {
      await updateAgentStatus(application.id, "needs_review",
        `Cannot automate: ${decision.reason}. ATS: ${recon.atsType}. Fields: ${recon.formFields.join(", ")}`);
      return NextResponse.json({
        status: "needs_review",
        phase: "decision",
        applicationId: application.id,
        atsType: recon.atsType,
        reason: decision.reason,
      }, { status: 200 });
    }

    // Phase 3: Execution
    if (!recon.scrapeId) {
      await updateAgentStatus(application.id, "failed", "No scrapeId available for interaction");
      return NextResponse.json({
        status: "failed",
        phase: "execution",
        applicationId: application.id,
        error: "No scrapeId for interact",
      }, { status: 200 });
    }

    const profile = profiles[0];
    const result = await executeApplication(recon.scrapeId, {
      name: profile.full_name || "Aziz Traore",
      email: profile.email || "",
      phone: profile.phone || undefined,
    });

    if (result.success) {
      await updateAgentStatus(application.id, "submitted", result.message);
      return NextResponse.json({
        status: "submitted",
        phase: "execution",
        applicationId: application.id,
        message: result.message,
      }, { status: 200 });
    } else {
      await updateAgentStatus(application.id, "failed", result.message);
      return NextResponse.json({
        status: "failed",
        phase: "execution",
        applicationId: application.id,
        error: result.message,
      }, { status: 200 });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error, "cowork/browser-apply");
    }
    return apiError(error, "cowork/browser-apply");
  }
}
```

**Step 3: Ecrire les tests**

Tester les 3 phases separement en mockant le client Firecrawl:
- `reconApplicationPage` avec differentes pages (Greenhouse simple, LinkedIn, page 404)
- `decideApplyStrategy` avec differents ReconResult
- `executeApplication` avec succes et echec

**Step 4: Run tests**

```bash
npx vitest run --reporter=verbose
```

**Step 5: Commit**

```bash
git add src/lib/services/browser-apply.ts src/app/api/cowork/browser-apply/route.ts
git commit -m "feat(browser-apply): implement 3-phase workflow with Firecrawl scrape+interact"
```

---

## Task 6: Document d'orchestration agent

**Files:**
- Create: `docs/agent-orchestration.md`

**Step 1: Ecrire le document**

Ce document sert de contexte systeme pour l'agent (OpenClaw/Claude Cowork) quand il pilote JobPilot. Il doit decrire:

1. **Le cycle quotidien** — quand faire quoi (expire, fetch, score, apply, notify)
2. **Les endpoints disponibles** — surface API cowork complete avec exemples
3. **Les regles de decision** — quand automatiser vs escalader
4. **La gestion des credits** — Firecrawl credits budget par jour
5. **Les codes d'erreur** — comment reagir a chaque type d'erreur
6. **Les colonnes agent** — semantique de agent_status, ats_type, agent_notes

Contenu detaille a rediger pendant l'implementation (depend de l'etat final du code).

**Step 2: Commit**

```bash
git add docs/agent-orchestration.md
git commit -m "docs: add agent orchestration guide for Cowork/OpenClaw integration"
```

---

## Task 7: Nettoyage + validation finale

**Files:**
- Modify: `package.json` (verifier que unpdf peut etre retire si plus utilise nulle part)
- Modify: `docs/compact_current.md` (mettre a jour l'etat)
- Modify: `docs/BACKLOG.md` (marquer BUG-2 comme resolu, browser-apply comme v1)

**Step 1: Verifier que unpdf n'est plus utilise**

```bash
grep -r "unpdf" src/
```

Si aucun resultat, retirer de package.json:
```bash
npm uninstall unpdf
```

**Step 2: Run all tests**

```bash
npx vitest run --reporter=verbose
```

**Step 3: Build**

```bash
npm run build
```

**Step 4: Mettre a jour les docs**

Mettre a jour compact_current.md et BACKLOG.md avec:
- BUG-2 resolu via Firecrawl PDF parser v2
- Source Firecrawl ajoutee au pipeline
- Deduplication amelioree
- browser-apply v1 fonctionnel (simple forms only)
- Document d'orchestration agent cree

**Step 5: Commit final**

```bash
git add -A
git commit -m "chore: cleanup unpdf, update docs after Firecrawl integration"
```

---

## Resume des commits prevus

| # | Message | Fichiers principaux |
|---|---------|-------------------|
| 1 | `feat: add Firecrawl SDK and client wrapper` | firecrawl.ts, env vars, package.json |
| 2 | `fix(analyze-cv): replace unpdf with Firecrawl PDF parser v2` | analyze-cv/route.ts |
| 3 | `feat(fetch): add Firecrawl as job source with search+extract` | firecrawl-jobs.ts, aggregator, migration 011 |
| 4 | `fix(dedup): improve normalization for cross-source dedup` | job.ts (normalize functions) |
| 5 | `feat(browser-apply): 3-phase workflow with scrape+interact` | browser-apply.ts, route.ts |
| 6 | `docs: agent orchestration guide` | agent-orchestration.md |
| 7 | `chore: cleanup + update docs` | compact, backlog, package.json |

## Dependances entre taches

```
Task 1 (setup) ──> Task 2 (PDF fix)
                ──> Task 3 (source fetch) ──> Task 4 (dedup)
                ──> Task 5 (browser-apply)
Task 6 (docs) peut etre fait en parallele
Task 7 (cleanup) en dernier
```
