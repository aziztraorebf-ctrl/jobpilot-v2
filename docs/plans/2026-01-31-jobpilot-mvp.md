# JobPilot MVP - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal job search assistant that aggregates listings from JSearch (RapidAPI) + Adzuna, scores them against a CV using OpenAI, generates cover letters, and tracks applications through a Kanban pipeline.

**Architecture:** Next.js 16 App Router monorepo with Supabase (PostgreSQL + Storage) as backend. Auth MVP via demo credentials + httpOnly cookie (Supabase Auth planned for Phase 6). All external API calls (JSearch, Adzuna, OpenAI) happen server-side via API routes. Bilingual FR/EN via next-intl. Single-user personal app.

**Tech Stack:** Next.js 16, TypeScript, TailwindCSS v4 (OKLch), shadcn/ui, Supabase (DB + Storage), OpenAI GPT-4o-mini, Zod, next-intl, React Email + Resend, Vitest, Playwright. Deploy on Vercel.

**API Migration Note:** JSearch (via RapidAPI) replaced Jooble in Phase 2 due to inconsistent data from Jooble API.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth MVP | Demo credentials + httpOnly cookie | Phase prototype, Supabase Auth planned Phase 6 |
| Layout | Route groups `(app)` / `(auth)` | Sidebar for authenticated pages, centered layout for login |
| CV Input | Upload PDF (parsing AI) | Better UX than plain text copy-paste |
| Notifications | Manual / Daily / Weekly (configurable) | User choice, no premature optimization |
| Alert threshold | Configurable (default 60/100) | User chooses minimum score for alerts. Options: 40, 50, 60, 70, 80 |
| Email template | React Email (responsive) | Beautiful responsive email templates for Phase 8 |
| Anti-hallucination | Cross-ref letter vs CV (MVP) | Extract skills from letter, compare with CV, flag inventions |
| Cron strategy | Lazy scoring + cron fetch-only | Vercel free cron = 10s max. Fetch only in cron, score on demand |
| Adzuna rate limits | Cache 24h + JSearch-first | 2500 calls/month max. Cache in DB, never repeat search within 24h |
| API sources | JSearch (RapidAPI) + Adzuna | JSearch replaced Jooble (inconsistent data) |
| Dedup | Hash-based MVP | Naive but sufficient to start. TODO: fuzzy matching later |
| Job actions | "View" + "Apply" separated | Two distinct actions for better UX |
| Dismissed jobs | Trash tab in Jobs page | Restorable within 30-day TTL |
| Export | CSV applications | Track stats (response rate, avg delay) |

---

## Phase 1: Foundation (Tasks 1-5)

### Task 1: Install Core Dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `.env.example`

**Step 1: Install runtime dependencies**

```bash
cd c:\Users\azizt\Workspace\jobpilot
npm install @supabase/supabase-js openai zod next-intl date-fns lucide-react resend
```

**Step 2: Install dev dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

**Step 3: Create `.env.example`**

Create `c:\Users\azizt\Workspace\jobpilot\.env.example`:
```bash
# Supabase (DB only, no Auth)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App Auth (simple password)
APP_PASSWORD=

# OpenAI
OPENAI_API_KEY=

# Jooble
JOOBLE_API_KEY=

# Adzuna
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=ca

# Security
CRON_SECRET=

# Notifications
RESEND_API_KEY=
NOTIFY_EMAIL=
```

**Step 4: Create Vitest config**

Create `c:\Users\azizt\Workspace\jobpilot\vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 5: Create test setup**

Create `c:\Users\azizt\Workspace\jobpilot\src\test\setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

**Step 6: Add test scripts to package.json**

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 7: Run tests to verify setup**

```bash
npm run test:run
```

Expected: 0 tests, no errors (confirms vitest loads).

**Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts .env.example
git commit -m "feat: install core dependencies and configure Vitest"
```

---

### Task 2: shadcn/ui Setup

**Files:**
- Modify: `src/app/globals.css`
- Create: `components.json`
- Create: `src/components/ui/button.tsx` (and others via CLI)

**Step 1: Initialize shadcn/ui**

```bash
cd c:\Users\azizt\Workspace\jobpilot
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables: yes.

> **Note:** Check Context7 for latest shadcn/ui init docs if the CLI prompts have changed.

**Step 2: Add essential components**

```bash
npx shadcn@latest add button card input label badge dialog dropdown-menu separator sheet tabs textarea select toast
```

**Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: configure shadcn/ui with essential components"
```

---

### Task 3: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

> **Context7-First:** Before writing SQL, check Supabase docs for latest PostgreSQL version, RLS syntax, and trigger patterns.

**Step 1: Create migration file**

Create `c:\Users\azizt\Workspace\jobpilot\supabase\migrations\001_initial_schema.sql`:
```sql
-- ============================================
-- Profiles (single user, no Supabase Auth)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    preferred_language TEXT DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en')),
    search_preferences JSONB DEFAULT '{}'::jsonb,
    openai_tokens_used INTEGER DEFAULT 0,
    openai_tokens_limit INTEGER DEFAULT 500000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default single user (run once after migration)
INSERT INTO public.profiles (full_name, email) VALUES ('Aziz', '');

-- ============================================
-- Resumes
-- ============================================
CREATE TABLE public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
    raw_text TEXT,
    parsed_data JSONB,
    is_primary BOOLEAN DEFAULT false,
    ai_tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_one_primary_cv ON public.resumes(user_id) WHERE is_primary = true;

-- ============================================
-- Job Listings
-- ============================================
CREATE TABLE public.job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('jooble', 'adzuna', 'manual')),
    source_id TEXT,
    source_url TEXT NOT NULL,
    dedup_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    company_name TEXT,
    location TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    description TEXT,
    salary_min NUMERIC,
    salary_max NUMERIC,
    salary_currency TEXT DEFAULT 'CAD',
    salary_is_predicted BOOLEAN DEFAULT false,
    job_type TEXT,
    category TEXT,
    contract_type TEXT,
    remote_type TEXT DEFAULT 'unknown' CHECK (remote_type IN ('onsite', 'hybrid', 'remote', 'unknown')),
    posted_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    raw_data JSONB,
    company_career_url TEXT,
    company_description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_dedup ON public.job_listings(dedup_hash);
CREATE INDEX idx_jobs_source ON public.job_listings(source, source_id);
CREATE INDEX idx_jobs_fetched ON public.job_listings(fetched_at DESC);

-- ============================================
-- Seen Jobs
-- ============================================
CREATE TABLE public.seen_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ DEFAULT NOW(),
    dismissed BOOLEAN DEFAULT false,
    UNIQUE(user_id, job_listing_id)
);

-- ============================================
-- Match Scores
-- ============================================
CREATE TABLE public.match_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    skill_match_score INTEGER CHECK (skill_match_score BETWEEN 0 AND 100),
    experience_match_score INTEGER CHECK (experience_match_score BETWEEN 0 AND 100),
    education_match_score INTEGER CHECK (education_match_score BETWEEN 0 AND 100),
    explanation TEXT NOT NULL,
    matching_skills TEXT[],
    missing_skills TEXT[],
    strengths TEXT[],
    concerns TEXT[],
    model_used TEXT DEFAULT 'gpt-4o-mini',
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_listing_id, resume_id)
);

-- ============================================
-- Applications
-- ============================================
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN (
        'saved', 'applying', 'applied', 'interview',
        'offer', 'accepted', 'rejected', 'withdrawn'
    )),
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    interview_at TIMESTAMPTZ,
    offer_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    resume_id UUID REFERENCES public.resumes(id),
    cover_letter_id UUID,
    application_method TEXT,
    application_url TEXT,
    recruiter_name TEXT,
    recruiter_email TEXT,
    recruiter_phone TEXT,
    recruiter_linkedin TEXT,
    notes TEXT,
    salary_offered NUMERIC,
    priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_user_status ON public.applications(user_id, status);

-- ============================================
-- Cover Letters
-- ============================================
CREATE TABLE public.cover_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
    tone TEXT DEFAULT 'professional' CHECK (tone IN (
        'professional', 'enthusiastic', 'creative', 'formal'
    )),
    version INTEGER DEFAULT 1,
    is_edited BOOLEAN DEFAULT false,
    model_used TEXT DEFAULT 'gpt-4o-mini',
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.applications
    ADD CONSTRAINT fk_cover_letter
    FOREIGN KEY (cover_letter_id) REFERENCES public.cover_letters(id);

-- ============================================
-- Activity Log
-- ============================================
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'status_change', 'note_added', 'cover_letter_generated',
        'cv_optimized', 'interview_scheduled', 'follow_up_sent',
        'recruiter_contact_added', 'custom'
    )),
    event_data JSONB DEFAULT '{}'::jsonb,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_app ON public.activity_log(application_id, created_at DESC);

-- ============================================
-- API Usage Tracking
-- ============================================
CREATE TABLE public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    api_name TEXT NOT NULL CHECK (api_name IN ('openai', 'jooble', 'adzuna')),
    operation TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER resumes_updated BEFORE UPDATE ON public.resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cover_letters_updated BEFORE UPDATE ON public.cover_letters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-log application status changes
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.activity_log (user_id, application_id, event_type, description, event_data)
        VALUES (
            NEW.user_id, NEW.id, 'status_change',
            format('Status: %s -> %s', OLD.status, NEW.status),
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER application_status_changed
    AFTER UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION log_application_status_change();
```

**Step 2: Run migration in Supabase dashboard**

Go to Supabase Dashboard > SQL Editor > paste and run the SQL above.

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add complete database schema with triggers"
```

---

### Task 4: Supabase Client + Simple Auth

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/auth.ts`
- Create: `src/types/database.ts`

> **Context7-First:** Check @supabase/supabase-js latest docs for createClient API.

**Step 1: Create Supabase server client**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\supabase\client.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Single server-side client using service_role key
// No RLS, no auth - protected by password middleware at Next.js level
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key);
}
```

**Step 2: Create simple password auth**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\auth.ts`:
```typescript
import { cookies } from "next/headers";
import { createHash } from "crypto";

const SESSION_COOKIE = "jobpilot_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function verifyPassword(password: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD not set");
  return password === expected;
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = hashPassword(process.env.APP_PASSWORD! + Date.now().toString());
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(SESSION_COOKIE);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
```

**Step 3: Create database types**

Create `c:\Users\azizt\Workspace\jobpilot\src\types\database.ts`:
```typescript
// TODO: Generate with `npx supabase gen types typescript` once project is linked
// For now, define manually based on our schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          preferred_language: "fr" | "en";
          search_preferences: Json;
          openai_tokens_used: number;
          openai_tokens_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      job_listings: {
        Row: {
          id: string;
          source: "jooble" | "adzuna" | "manual";
          source_id: string | null;
          source_url: string;
          dedup_hash: string;
          title: string;
          company_name: string | null;
          location: string | null;
          location_lat: number | null;
          location_lng: number | null;
          description: string | null;
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string;
          salary_is_predicted: boolean;
          job_type: string | null;
          category: string | null;
          contract_type: string | null;
          remote_type: "onsite" | "hybrid" | "remote" | "unknown";
          posted_at: string | null;
          fetched_at: string;
          raw_data: Json;
          company_career_url: string | null;
          company_description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["job_listings"]["Row"]> &
          Pick<Database["public"]["Tables"]["job_listings"]["Row"], "source" | "source_url" | "dedup_hash" | "title">;
        Update: Partial<Database["public"]["Tables"]["job_listings"]["Row"]>;
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_type: "pdf" | "docx" | "txt";
          raw_text: string | null;
          parsed_data: Json;
          is_primary: boolean;
          ai_tokens_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["resumes"]["Row"], "id" | "created_at" | "updated_at" | "ai_tokens_used" | "is_primary"> & {
          is_primary?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["resumes"]["Insert"]>;
      };
      seen_jobs: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          seen_at: string;
          dismissed: boolean;
        };
        Insert: Pick<Database["public"]["Tables"]["seen_jobs"]["Row"], "user_id" | "job_listing_id"> & {
          dismissed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["seen_jobs"]["Insert"]>;
      };
      match_scores: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          resume_id: string;
          overall_score: number;
          skill_match_score: number | null;
          experience_match_score: number | null;
          education_match_score: number | null;
          explanation: string;
          matching_skills: string[];
          missing_skills: string[];
          strengths: string[];
          concerns: string[];
          model_used: string;
          tokens_used: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["match_scores"]["Row"], "id" | "created_at" | "model_used" | "tokens_used">;
        Update: Partial<Database["public"]["Tables"]["match_scores"]["Insert"]>;
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          status: "saved" | "applying" | "applied" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";
          saved_at: string;
          applied_at: string | null;
          interview_at: string | null;
          offer_at: string | null;
          closed_at: string | null;
          resume_id: string | null;
          cover_letter_id: string | null;
          application_method: string | null;
          application_url: string | null;
          recruiter_name: string | null;
          recruiter_email: string | null;
          recruiter_phone: string | null;
          recruiter_linkedin: string | null;
          notes: string | null;
          salary_offered: number | null;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Pick<Database["public"]["Tables"]["applications"]["Row"], "user_id" | "job_listing_id"> & {
          status?: string;
          priority?: number;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Row"]>;
      };
      cover_letters: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          resume_id: string;
          content: string;
          language: "fr" | "en";
          tone: "professional" | "enthusiastic" | "creative" | "formal";
          version: number;
          is_edited: boolean;
          model_used: string;
          tokens_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Pick<Database["public"]["Tables"]["cover_letters"]["Row"], "user_id" | "job_listing_id" | "resume_id" | "content"> & {
          language?: "fr" | "en";
          tone?: "professional" | "enthusiastic" | "creative" | "formal";
        };
        Update: Partial<Database["public"]["Tables"]["cover_letters"]["Row"]>;
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          event_type: string;
          event_data: Json;
          description: string;
          created_at: string;
        };
        Insert: Pick<Database["public"]["Tables"]["activity_log"]["Row"], "user_id" | "event_type" | "description"> & {
          application_id?: string;
          event_data?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Insert"]>;
      };
      api_usage: {
        Row: {
          id: string;
          user_id: string;
          api_name: "openai" | "jooble" | "adzuna";
          operation: string;
          tokens_input: number;
          tokens_output: number;
          estimated_cost_usd: number;
          created_at: string;
        };
        Insert: Pick<Database["public"]["Tables"]["api_usage"]["Row"], "user_id" | "api_name" | "operation"> & {
          tokens_input?: number;
          tokens_output?: number;
          estimated_cost_usd?: number;
        };
        Update: Partial<Database["public"]["Tables"]["api_usage"]["Insert"]>;
      };
    };
  };
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/lib/supabase/ src/lib/auth.ts src/types/
git commit -m "feat: add Supabase client, auth utilities, and database types"
```

---

### Task 5: Auth Middleware + i18n Setup

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`
- Create: `messages/fr.json`
- Create: `messages/en.json`
- Create: `src/middleware.ts`
- Modify: `next.config.ts`

> **Context7-First:** Check next-intl latest docs for App Router integration with Next.js 16.

**Step 1: Configure next-intl routing**

Create `c:\Users\azizt\Workspace\jobpilot\src\i18n\routing.ts`:
```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});
```

Create `c:\Users\azizt\Workspace\jobpilot\src\i18n\request.ts`:
```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "fr" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

**Step 2: Create translation files**

Create `c:\Users\azizt\Workspace\jobpilot\messages\fr.json`:
```json
{
  "common": {
    "appName": "JobPilot",
    "loading": "Chargement...",
    "save": "Sauvegarder",
    "cancel": "Annuler",
    "delete": "Supprimer",
    "edit": "Modifier",
    "search": "Rechercher",
    "noResults": "Aucun resultat"
  },
  "nav": {
    "dashboard": "Tableau de bord",
    "search": "Recherche",
    "applications": "Candidatures",
    "cv": "Mon CV",
    "coverLetters": "Lettres de motivation",
    "settings": "Parametres"
  },
  "auth": {
    "login": "Se connecter",
    "password": "Mot de passe",
    "logout": "Se deconnecter"
  }
}
```

Create `c:\Users\azizt\Workspace\jobpilot\messages\en.json`:
```json
{
  "common": {
    "appName": "JobPilot",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "noResults": "No results"
  },
  "nav": {
    "dashboard": "Dashboard",
    "search": "Search",
    "applications": "Applications",
    "cv": "My CV",
    "coverLetters": "Cover Letters",
    "settings": "Settings"
  },
  "auth": {
    "login": "Sign in",
    "password": "Password",
    "logout": "Sign out"
  }
}
```

**Step 3: Configure middleware (auth + i18n combined)**

Create `c:\Users\azizt\Workspace\jobpilot\src\middleware.ts`:
```typescript
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);
const SESSION_COOKIE = "jobpilot_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and API login route without auth
  const isLoginPage = pathname.includes("/login");
  const isApiLogin = pathname.startsWith("/api/auth");
  if (isLoginPage || isApiLogin) {
    return intlMiddleware(request);
  }

  // Check for session cookie
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|api/(?!auth)|.*\\..*).*)"],
};
```

**Step 4: Update next.config.ts**

Modify `c:\Users\azizt\Workspace\jobpilot\next.config.ts`:
```typescript
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig = {};

export default withNextIntl(nextConfig);
```

**Step 5: Build to verify**

```bash
npm run build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/i18n/ src/middleware.ts messages/ next.config.ts
git commit -m "feat: configure i18n (FR/EN) and auth middleware"
```

---

## Phase 2: Data Layer (Tasks 6-10)

### Task 6: Zod Schemas for Job Data

**Files:**
- Create: `src/lib/schemas/job.ts`
- Test: `src/lib/schemas/__tests__/job.test.ts`

**Step 1: Write the failing test**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\schemas\__tests__\job.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  JoobleJobSchema,
  AdzunaJobSchema,
  normalizeJoobleJob,
  normalizeAdzunaJob,
} from "../job";

describe("JoobleJobSchema", () => {
  it("validates a valid Jooble response", () => {
    const raw = {
      title: "Data Analyst",
      company: "Desjardins",
      location: "Montreal, QC",
      salary: "60000",
      snippet: "Nous cherchons un analyste...",
      link: "https://jooble.org/jobs/123",
      type: "Full-time",
      updated: "2026-01-20T10:00:00Z",
      id: "123",
    };
    expect(JoobleJobSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects missing title", () => {
    const raw = { company: "Test", link: "https://example.com" };
    expect(JoobleJobSchema.safeParse(raw).success).toBe(false);
  });
});

describe("AdzunaJobSchema", () => {
  it("validates a valid Adzuna response", () => {
    const raw = {
      id: "456",
      title: "Software Developer",
      company: { display_name: "Shopify" },
      location: { display_name: "Ottawa, ON", area: ["Canada", "Ontario"] },
      salary_min: 70000,
      salary_max: 90000,
      salary_is_predicted: 0,
      description: "Building cool stuff...",
      redirect_url: "https://adzuna.ca/jobs/456",
      created: "2026-01-15T08:00:00Z",
      category: { label: "IT Jobs", tag: "it-jobs" },
      contract_type: "permanent",
      contract_time: "full_time",
    };
    expect(AdzunaJobSchema.safeParse(raw).success).toBe(true);
  });
});

describe("normalizeJoobleJob", () => {
  it("converts Jooble job to UnifiedJob", () => {
    const jooble = {
      title: "Data Analyst",
      company: "Desjardins",
      location: "Montreal, QC",
      salary: "60000-75000",
      snippet: "Nous cherchons un analyste...",
      link: "https://jooble.org/jobs/123",
      type: "Full-time",
      updated: "2026-01-20T10:00:00Z",
      id: "123",
    };
    const unified = normalizeJoobleJob(jooble);
    expect(unified.source).toBe("jooble");
    expect(unified.title).toBe("Data Analyst");
    expect(unified.company_name).toBe("Desjardins");
    expect(unified.source_url).toBe("https://jooble.org/jobs/123");
  });
});

describe("normalizeAdzunaJob", () => {
  it("converts Adzuna job to UnifiedJob with salary", () => {
    const adzuna = {
      id: "456",
      title: "Software Developer",
      company: { display_name: "Shopify" },
      location: { display_name: "Ottawa, ON", area: ["Canada", "Ontario"] },
      salary_min: 70000,
      salary_max: 90000,
      salary_is_predicted: 0,
      description: "Building cool stuff...",
      redirect_url: "https://adzuna.ca/jobs/456",
      created: "2026-01-15T08:00:00Z",
      category: { label: "IT Jobs", tag: "it-jobs" },
      contract_type: "permanent",
      contract_time: "full_time",
    };
    const unified = normalizeAdzunaJob(adzuna);
    expect(unified.source).toBe("adzuna");
    expect(unified.salary_min).toBe(70000);
    expect(unified.salary_max).toBe(90000);
    expect(unified.category).toBe("IT Jobs");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/schemas/__tests__/job.test.ts
```

Expected: FAIL - module not found.

**Step 3: Write implementation**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\schemas\job.ts`:
```typescript
import { z } from "zod";
import { createHash } from "crypto";

// --- Jooble API response schema ---
export const JoobleJobSchema = z.object({
  title: z.string().min(1),
  company: z.string().nullish().default(null),
  location: z.string().nullish().default(null),
  salary: z.string().nullish().default(null),
  snippet: z.string().nullish().default(null),
  link: z.string().url(),
  type: z.string().nullish().default(null),
  updated: z.string().nullish().default(null),
  id: z.string().nullish().default(null),
});

export type JoobleJob = z.infer<typeof JoobleJobSchema>;

// --- Adzuna API response schema ---
export const AdzunaJobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  company: z.object({ display_name: z.string() }).nullish(),
  location: z.object({
    display_name: z.string(),
    area: z.array(z.string()).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  salary_is_predicted: z.union([z.number(), z.boolean()]).nullish(),
  description: z.string().nullish(),
  redirect_url: z.string().url(),
  created: z.string().nullish(),
  category: z.object({
    label: z.string(),
    tag: z.string().optional(),
  }).nullish(),
  contract_type: z.string().nullish(),
  contract_time: z.string().nullish(),
});

export type AdzunaJob = z.infer<typeof AdzunaJobSchema>;

// --- Unified job type ---
export const UnifiedJobSchema = z.object({
  source: z.enum(["jooble", "adzuna", "manual"]),
  source_id: z.string().nullable(),
  source_url: z.string().url(),
  dedup_hash: z.string(),
  title: z.string(),
  company_name: z.string().nullable(),
  location: z.string().nullable(),
  location_lat: z.number().nullable(),
  location_lng: z.number().nullable(),
  description: z.string().nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string().default("CAD"),
  salary_is_predicted: z.boolean().default(false),
  job_type: z.string().nullable(),
  category: z.string().nullable(),
  contract_type: z.string().nullable(),
  remote_type: z.enum(["onsite", "hybrid", "remote", "unknown"]).default("unknown"),
  posted_at: z.string().nullable(),
  raw_data: z.unknown(),
});

export type UnifiedJob = z.infer<typeof UnifiedJobSchema>;

// --- Dedup hash ---
function normalize(s: string | null | undefined): string {
  return (s || "unknown").toLowerCase().trim().replace(/\s+/g, " ");
}

export function computeDedupHash(title: string, company: string | null, location: string | null): string {
  const input = [normalize(title), normalize(company), normalize(location)].join("|");
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

// --- Normalizers ---
function detectRemoteType(title: string, description: string | null): "onsite" | "hybrid" | "remote" | "unknown" {
  const text = `${title} ${description || ""}`.toLowerCase();
  if (text.includes("remote") || text.includes("teletravail") || text.includes("a distance")) return "remote";
  if (text.includes("hybrid") || text.includes("hybride")) return "hybrid";
  return "unknown";
}

export function normalizeJoobleJob(raw: JoobleJob): UnifiedJob {
  const hash = computeDedupHash(raw.title, raw.company ?? null, raw.location ?? null);
  return {
    source: "jooble",
    source_id: raw.id ?? null,
    source_url: raw.link,
    dedup_hash: hash,
    title: raw.title,
    company_name: raw.company ?? null,
    location: raw.location ?? null,
    location_lat: null,
    location_lng: null,
    description: raw.snippet ?? null,
    salary_min: null,
    salary_max: null,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: raw.type ?? null,
    category: null,
    contract_type: null,
    remote_type: detectRemoteType(raw.title, raw.snippet ?? null),
    posted_at: raw.updated ?? null,
    raw_data: raw,
  };
}

export function normalizeAdzunaJob(raw: AdzunaJob): UnifiedJob {
  const companyName = raw.company?.display_name ?? null;
  const locationName = raw.location?.display_name ?? null;
  const hash = computeDedupHash(raw.title, companyName, locationName);
  return {
    source: "adzuna",
    source_id: String(raw.id),
    source_url: raw.redirect_url,
    dedup_hash: hash,
    title: raw.title,
    company_name: companyName,
    location: locationName,
    location_lat: raw.location?.latitude ?? null,
    location_lng: raw.location?.longitude ?? null,
    description: raw.description ?? null,
    salary_min: raw.salary_min ?? null,
    salary_max: raw.salary_max ?? null,
    salary_currency: "CAD",
    salary_is_predicted: Boolean(raw.salary_is_predicted),
    job_type: raw.contract_time ?? null,
    category: raw.category?.label ?? null,
    contract_type: raw.contract_type ?? null,
    remote_type: detectRemoteType(raw.title, raw.description ?? null),
    posted_at: raw.created ?? null,
    raw_data: raw,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/schemas/__tests__/job.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/schemas/
git commit -m "feat: add Zod schemas and normalizers for Jooble + Adzuna APIs"
```

---

### Task 7: Deduplication Service

**Files:**
- Create: `src/lib/services/deduplicator.ts`
- Test: `src/lib/services/__tests__/deduplicator.test.ts`

**Step 1: Write the failing test**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\__tests__\deduplicator.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { deduplicateJobs } from "../deduplicator";
import type { UnifiedJob } from "@/lib/schemas/job";

function makeJob(overrides: Partial<UnifiedJob>): UnifiedJob {
  return {
    source: "jooble",
    source_id: "1",
    source_url: "https://example.com/1",
    dedup_hash: "abc123",
    title: "Developer",
    company_name: "Acme",
    location: "Montreal",
    location_lat: null,
    location_lng: null,
    description: "A job",
    salary_min: null,
    salary_max: null,
    salary_currency: "CAD",
    salary_is_predicted: false,
    job_type: null,
    category: null,
    contract_type: null,
    remote_type: "unknown",
    posted_at: null,
    raw_data: {},
    ...overrides,
  };
}

describe("deduplicateJobs", () => {
  it("removes duplicates with same dedup_hash", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", source: "jooble", source_id: "1" }),
      makeJob({ dedup_hash: "aaa", source: "adzuna", source_id: "2" }),
      makeJob({ dedup_hash: "bbb", source: "jooble", source_id: "3" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(2);
  });

  it("prefers adzuna over jooble (more data)", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", source: "jooble", salary_min: null }),
      makeJob({ dedup_hash: "aaa", source: "adzuna", salary_min: 50000, location_lat: 45.5 }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("adzuna");
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateJobs([])).toEqual([]);
  });

  it("preserves order of first-seen unique jobs", () => {
    const jobs = [
      makeJob({ dedup_hash: "aaa", title: "First" }),
      makeJob({ dedup_hash: "bbb", title: "Second" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result[0].title).toBe("First");
    expect(result[1].title).toBe("Second");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/services/__tests__/deduplicator.test.ts
```

Expected: FAIL.

**Step 3: Write implementation**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\deduplicator.ts`:
```typescript
import type { UnifiedJob } from "@/lib/schemas/job";

const SOURCE_PRIORITY: Record<string, number> = {
  adzuna: 2,
  jooble: 1,
  manual: 3,
};

function dataRichness(job: UnifiedJob): number {
  let score = SOURCE_PRIORITY[job.source] ?? 0;
  if (job.salary_min !== null) score += 2;
  if (job.salary_max !== null) score += 1;
  if (job.location_lat !== null) score += 1;
  if (job.category !== null) score += 1;
  if (job.contract_type !== null) score += 1;
  if (job.description && job.description.length > 200) score += 1;
  return score;
}

export function deduplicateJobs(jobs: UnifiedJob[]): UnifiedJob[] {
  const seen = new Map<string, UnifiedJob>();

  for (const job of jobs) {
    const existing = seen.get(job.dedup_hash);
    if (!existing || dataRichness(job) > dataRichness(existing)) {
      seen.set(job.dedup_hash, job);
    }
  }

  const orderedHashes: string[] = [];
  const hashSet = new Set<string>();
  for (const job of jobs) {
    if (!hashSet.has(job.dedup_hash)) {
      orderedHashes.push(job.dedup_hash);
      hashSet.add(job.dedup_hash);
    }
  }

  return orderedHashes.map((hash) => seen.get(hash)!);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/services/__tests__/deduplicator.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/lib/services/
git commit -m "feat: add job deduplication service with data richness scoring"
```

---

### Task 8: Jooble API Client

**Files:**
- Create: `src/lib/api/jooble.ts`
- Test: `src/lib/api/__tests__/jooble.test.ts`

> **Context7-First:** Verify Jooble API docs for current endpoint format and response structure.

**Step 1: Write the failing test**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\api\__tests__\jooble.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchJooble, type JoobleSearchParams } from "../jooble";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("searchJooble", () => {
  beforeEach(() => {
    vi.stubEnv("JOOBLE_API_KEY", "test-key");
    mockFetch.mockReset();
  });

  it("calls Jooble API with correct URL and body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ totalCount: 0, jobs: [] }),
    });

    const params: JoobleSearchParams = {
      keywords: "data analyst",
      location: "Montreal, QC",
    };
    await searchJooble(params);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://jooble.org/api/test-key",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("returns normalized UnifiedJob array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        totalCount: 1,
        jobs: [
          {
            title: "Analyst",
            company: "Desjardins",
            location: "Montreal",
            salary: "",
            snippet: "Great job",
            link: "https://jooble.org/j/1",
            type: "Full-time",
            updated: "2026-01-20T00:00:00Z",
            id: "1",
          },
        ],
      }),
    });

    const result = await searchJooble({ keywords: "analyst" });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].source).toBe("jooble");
    expect(result.jobs[0].title).toBe("Analyst");
    expect(result.total).toBe(1);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" });
    await expect(searchJooble({ keywords: "test" })).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/api/__tests__/jooble.test.ts
```

**Step 3: Write implementation**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\api\jooble.ts`:
```typescript
import { JoobleJobSchema, normalizeJoobleJob, type UnifiedJob } from "@/lib/schemas/job";
import { z } from "zod";

export interface JoobleSearchParams {
  keywords: string;
  location?: string;
  radius?: number;
  salary?: number;
  page?: number;
  resultsOnPage?: number;
}

const JoobleResponseSchema = z.object({
  totalCount: z.number(),
  jobs: z.array(z.unknown()),
});

export async function searchJooble(params: JoobleSearchParams): Promise<{ jobs: UnifiedJob[]; total: number }> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) throw new Error("JOOBLE_API_KEY is not set");

  const body: Record<string, unknown> = {
    keywords: params.keywords,
  };
  if (params.location) body.location = params.location;
  if (params.radius !== undefined) body.radius = params.radius;
  if (params.salary !== undefined) body.salary = params.salary;
  if (params.page !== undefined) body.page = params.page;
  if (params.resultsOnPage !== undefined) body.ResultOnPage = params.resultsOnPage;

  const response = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Jooble API error: ${response.status} ${response.statusText}`);
  }

  const data = JoobleResponseSchema.parse(await response.json());

  const jobs: UnifiedJob[] = [];
  for (const rawJob of data.jobs) {
    const parsed = JoobleJobSchema.safeParse(rawJob);
    if (parsed.success) {
      jobs.push(normalizeJoobleJob(parsed.data));
    }
  }

  return { jobs, total: data.totalCount };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/api/__tests__/jooble.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/lib/api/jooble.ts src/lib/api/__tests__/jooble.test.ts
git commit -m "feat: add Jooble API client with Zod validation"
```

---

### Task 9: Adzuna API Client

**Files:**
- Create: `src/lib/api/adzuna.ts`
- Test: `src/lib/api/__tests__/adzuna.test.ts`

> **Context7-First:** Verify Adzuna API v1 docs for current endpoint format and response structure.

**Step 1: Write the failing test**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\api\__tests__\adzuna.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchAdzuna, type AdzunaSearchParams } from "../adzuna";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("searchAdzuna", () => {
  beforeEach(() => {
    vi.stubEnv("ADZUNA_APP_ID", "test-id");
    vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    vi.stubEnv("ADZUNA_COUNTRY", "ca");
    mockFetch.mockReset();
  });

  it("calls Adzuna API with correct URL params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });

    await searchAdzuna({ keywords: "developer", location: "Montreal" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.adzuna.com");
    expect(calledUrl).toContain("app_id=test-id");
    expect(calledUrl).toContain("app_key=test-key");
    expect(calledUrl).toContain("what=developer");
    expect(calledUrl).toContain("where=Montreal");
  });

  it("returns normalized UnifiedJob array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        count: 1,
        results: [
          {
            id: "789",
            title: "Dev",
            company: { display_name: "Shopify" },
            location: { display_name: "Ottawa" },
            salary_min: 80000,
            salary_max: 100000,
            description: "Nice job",
            redirect_url: "https://adzuna.ca/j/789",
            created: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });

    const result = await searchAdzuna({ keywords: "dev" });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].source).toBe("adzuna");
    expect(result.jobs[0].salary_min).toBe(80000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/api/__tests__/adzuna.test.ts
```

**Step 3: Write implementation**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\api\adzuna.ts`:
```typescript
import { AdzunaJobSchema, normalizeAdzunaJob, type UnifiedJob } from "@/lib/schemas/job";
import { z } from "zod";

export interface AdzunaSearchParams {
  keywords: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  page?: number;
  resultsPerPage?: number;
  sortBy?: "relevance" | "date" | "salary";
  maxDaysOld?: number;
  category?: string;
  fullTime?: boolean;
}

const AdzunaResponseSchema = z.object({
  count: z.number(),
  results: z.array(z.unknown()),
});

export async function searchAdzuna(params: AdzunaSearchParams): Promise<{ jobs: UnifiedJob[]; total: number }> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = process.env.ADZUNA_COUNTRY || "ca";

  if (!appId || !appKey) throw new Error("ADZUNA_APP_ID or ADZUNA_APP_KEY is not set");

  const page = params.page || 1;
  const resultsPerPage = params.resultsPerPage || 20;

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("what", params.keywords);
  url.searchParams.set("results_per_page", String(resultsPerPage));

  if (params.location) url.searchParams.set("where", params.location);
  if (params.salaryMin) url.searchParams.set("salary_min", String(params.salaryMin));
  if (params.salaryMax) url.searchParams.set("salary_max", String(params.salaryMax));
  if (params.sortBy) url.searchParams.set("sort_by", params.sortBy);
  if (params.maxDaysOld) url.searchParams.set("max_days_old", String(params.maxDaysOld));
  if (params.category) url.searchParams.set("category", params.category);
  if (params.fullTime !== undefined) url.searchParams.set("full_time", params.fullTime ? "1" : "0");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status} ${response.statusText}`);
  }

  const data = AdzunaResponseSchema.parse(await response.json());

  const jobs: UnifiedJob[] = [];
  for (const rawJob of data.results) {
    const parsed = AdzunaJobSchema.safeParse(rawJob);
    if (parsed.success) {
      jobs.push(normalizeAdzunaJob(parsed.data));
    }
  }

  return { jobs, total: data.count };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/api/__tests__/adzuna.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/lib/api/adzuna.ts src/lib/api/__tests__/adzuna.test.ts
git commit -m "feat: add Adzuna API client with Zod validation"
```

---

### Task 10: Job Aggregator Service

**Files:**
- Create: `src/lib/services/job-aggregator.ts`
- Test: `src/lib/services/__tests__/job-aggregator.test.ts`

**Step 1: Write the failing test**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\__tests__\job-aggregator.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { aggregateJobSearch, type AggregateSearchParams } from "../job-aggregator";

vi.mock("@/lib/api/jooble", () => ({
  searchJooble: vi.fn().mockResolvedValue({
    jobs: [
      {
        source: "jooble", source_id: "j1", source_url: "https://jooble.org/j/1",
        dedup_hash: "hash_a", title: "Analyst", company_name: "CompanyA",
        location: "Montreal", location_lat: null, location_lng: null,
        description: "Job A", salary_min: null, salary_max: null,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: null, category: null, contract_type: null,
        remote_type: "unknown", posted_at: null, raw_data: {},
      },
    ],
    total: 1,
  }),
}));

vi.mock("@/lib/api/adzuna", () => ({
  searchAdzuna: vi.fn().mockResolvedValue({
    jobs: [
      {
        source: "adzuna", source_id: "a1", source_url: "https://adzuna.ca/j/1",
        dedup_hash: "hash_a", title: "Analyst", company_name: "CompanyA",
        location: "Montreal", location_lat: 45.5, location_lng: -73.5,
        description: "Job A from Adzuna", salary_min: 60000, salary_max: 75000,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: "full_time", category: "IT Jobs", contract_type: "permanent",
        remote_type: "unknown", posted_at: "2026-01-15", raw_data: {},
      },
      {
        source: "adzuna", source_id: "a2", source_url: "https://adzuna.ca/j/2",
        dedup_hash: "hash_b", title: "Dev", company_name: "CompanyB",
        location: "Ottawa", location_lat: null, location_lng: null,
        description: "Job B", salary_min: null, salary_max: null,
        salary_currency: "CAD", salary_is_predicted: false,
        job_type: null, category: null, contract_type: null,
        remote_type: "unknown", posted_at: null, raw_data: {},
      },
    ],
    total: 2,
  }),
}));

describe("aggregateJobSearch", () => {
  it("combines results from both APIs and deduplicates", async () => {
    const params: AggregateSearchParams = { keywords: "analyst", location: "Montreal" };
    const result = await aggregateJobSearch(params);
    expect(result.jobs).toHaveLength(2);
  });

  it("prefers adzuna version of duplicates (richer data)", async () => {
    const params: AggregateSearchParams = { keywords: "analyst" };
    const result = await aggregateJobSearch(params);
    const analystJob = result.jobs.find((j) => j.dedup_hash === "hash_a");
    expect(analystJob?.source).toBe("adzuna");
    expect(analystJob?.salary_min).toBe(60000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/services/__tests__/job-aggregator.test.ts
```

**Step 3: Write implementation**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\job-aggregator.ts`:
```typescript
import { searchJooble } from "@/lib/api/jooble";
import { searchAdzuna } from "@/lib/api/adzuna";
import { deduplicateJobs } from "./deduplicator";
import type { UnifiedJob } from "@/lib/schemas/job";

export interface AggregateSearchParams {
  keywords: string;
  location?: string;
  salaryMin?: number;
  page?: number;
  sources?: ("jooble" | "adzuna")[];
}

export interface AggregateSearchResult {
  jobs: UnifiedJob[];
  totalJooble: number;
  totalAdzuna: number;
  errors: string[];
}

export async function aggregateJobSearch(params: AggregateSearchParams): Promise<AggregateSearchResult> {
  const sources = params.sources || ["jooble", "adzuna"];
  const errors: string[] = [];
  let joobleJobs: UnifiedJob[] = [];
  let adzunaJobs: UnifiedJob[] = [];
  let totalJooble = 0;
  let totalAdzuna = 0;

  const promises: Promise<void>[] = [];

  if (sources.includes("jooble")) {
    promises.push(
      searchJooble({
        keywords: params.keywords,
        location: params.location,
        salary: params.salaryMin,
        page: params.page,
      })
        .then((result) => {
          joobleJobs = result.jobs;
          totalJooble = result.total;
        })
        .catch((err) => {
          errors.push(`Jooble: ${err instanceof Error ? err.message : String(err)}`);
        })
    );
  }

  if (sources.includes("adzuna")) {
    promises.push(
      searchAdzuna({
        keywords: params.keywords,
        location: params.location,
        salaryMin: params.salaryMin,
        page: params.page,
      })
        .then((result) => {
          adzunaJobs = result.jobs;
          totalAdzuna = result.total;
        })
        .catch((err) => {
          errors.push(`Adzuna: ${err instanceof Error ? err.message : String(err)}`);
        })
    );
  }

  await Promise.allSettled(promises);

  const allJobs = [...joobleJobs, ...adzunaJobs];
  const deduplicated = deduplicateJobs(allJobs);

  return { jobs: deduplicated, totalJooble, totalAdzuna, errors };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/services/__tests__/job-aggregator.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add src/lib/services/job-aggregator.ts src/lib/services/__tests__/job-aggregator.test.ts
git commit -m "feat: add job aggregator service combining Jooble + Adzuna"
```

---

## Phase 3: AI Services (Tasks 11-12)

### Task 11: OpenAI Client + AI Schemas

**Files:**
- Create: `src/lib/api/openai.ts`
- Create: `src/lib/schemas/ai-responses.ts`
- Test: `src/lib/schemas/__tests__/ai-responses.test.ts`

> **Context7-First:** Check OpenAI SDK latest docs for `responses.parse` API and `zodTextFormat`.

**Step 1: Write the failing test for AI schemas**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\schemas\__tests__\ai-responses.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { MatchScoreSchema, ParsedResumeSchema, CoverLetterResponseSchema } from "../ai-responses";

describe("MatchScoreSchema", () => {
  it("validates a valid match score", () => {
    const data = {
      overall_score: 75,
      skill_match_score: 80,
      experience_match_score: 70,
      education_match_score: 60,
      explanation: "Good match for the role",
      matching_skills: ["Python", "SQL"],
      missing_skills: ["Tableau"],
      strengths: ["Strong analytics background"],
      concerns: ["No experience with specific tool"],
    };
    expect(MatchScoreSchema.safeParse(data).success).toBe(true);
  });

  it("rejects score out of range", () => {
    const data = {
      overall_score: 150,
      skill_match_score: 80,
      experience_match_score: 70,
      education_match_score: 60,
      explanation: "Test",
      matching_skills: [],
      missing_skills: [],
      strengths: [],
      concerns: [],
    };
    expect(MatchScoreSchema.safeParse(data).success).toBe(false);
  });
});

describe("ParsedResumeSchema", () => {
  it("validates a valid parsed resume", () => {
    const data = {
      personal: { name: "Aziz", location: "Montreal, QC" },
      summary: "Experienced analyst",
      skills: {
        technical: ["Python", "SQL", "Excel"],
        soft: ["Communication", "Leadership"],
        languages: ["Francais", "English"],
      },
      experience: [
        {
          title: "Data Analyst",
          company: "ABC Corp",
          start_date: "2022-01",
          end_date: "2025-06",
          description: "Analyzed data",
          achievements: ["Improved reports"],
        },
      ],
      education: [
        {
          degree: "BSc Computer Science",
          institution: "Universite de Montreal",
          year: "2022",
          field: "CS",
        },
      ],
      certifications: ["AWS Certified"],
    };
    expect(ParsedResumeSchema.safeParse(data).success).toBe(true);
  });
});

describe("CoverLetterResponseSchema", () => {
  it("validates a valid cover letter response", () => {
    const data = {
      subject: "Application for Data Analyst",
      greeting: "Dear Hiring Manager,",
      body: "I am writing to express my interest...",
      closing: "Sincerely, Aziz",
      full_text: "Dear Hiring Manager, I am writing...",
    };
    expect(CoverLetterResponseSchema.safeParse(data).success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/schemas/__tests__/ai-responses.test.ts
```

**Step 3: Write AI schemas**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\schemas\ai-responses.ts`:
```typescript
import { z } from "zod";

export const MatchScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  skill_match_score: z.number().int().min(0).max(100),
  experience_match_score: z.number().int().min(0).max(100),
  education_match_score: z.number().int().min(0).max(100),
  explanation: z.string().max(500),
  matching_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  strengths: z.array(z.string().max(200)),
  concerns: z.array(z.string().max(200)),
});

export type MatchScore = z.infer<typeof MatchScoreSchema>;

export const ParsedResumeSchema = z.object({
  personal: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
  }),
  summary: z.string(),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
    languages: z.array(z.string()),
  }),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      start_date: z.string(),
      end_date: z.string().nullable().optional(),
      description: z.string(),
      achievements: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string(),
      field: z.string().optional(),
    })
  ),
  certifications: z.array(z.string()).optional().default([]),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

export const CoverLetterResponseSchema = z.object({
  subject: z.string(),
  greeting: z.string(),
  body: z.string(),
  closing: z.string(),
  full_text: z.string(),
});

export type CoverLetterResponse = z.infer<typeof CoverLetterResponseSchema>;

export const CvOptimizationSchema = z.object({
  suggestions: z.array(
    z.object({
      section: z.string(),
      current: z.string(),
      suggested: z.string(),
      reason: z.string(),
    })
  ),
  keywords_to_add: z.array(z.string()),
  overall_advice: z.string(),
});

export type CvOptimization = z.infer<typeof CvOptimizationSchema>;
```

**Step 4: Write OpenAI client**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\api\openai.ts`:
```typescript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export interface AiCallResult<T> {
  data: T;
  tokensInput: number;
  tokensOutput: number;
}

export async function callStructured<T>(options: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  model?: string;
}): Promise<AiCallResult<T>> {
  const openai = getClient();
  const model = options.model || "gpt-4o-mini";

  const response = await openai.responses.parse({
    model,
    instructions: options.systemPrompt,
    input: options.userPrompt,
    text: {
      format: zodTextFormat(options.schema, options.schemaName),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed output");
  }

  return {
    data: response.output_parsed as T,
    tokensInput: response.usage?.input_tokens ?? 0,
    tokensOutput: response.usage?.output_tokens ?? 0,
  };
}
```

**Step 5: Run tests**

```bash
npx vitest run src/lib/schemas/__tests__/ai-responses.test.ts
```

Expected: All PASS.

**Step 6: Commit**

```bash
git add src/lib/api/openai.ts src/lib/schemas/ai-responses.ts src/lib/schemas/__tests__/ai-responses.test.ts
git commit -m "feat: add OpenAI client with structured outputs and AI Zod schemas"
```

---

### Task 12: AI Services (Match Scorer + CV Parser + Cover Letter Generator)

**Files:**
- Create: `src/lib/services/match-scorer.ts`
- Create: `src/lib/services/cv-parser.ts`
- Create: `src/lib/services/cover-letter-generator.ts`
- Test: `src/lib/services/__tests__/match-scorer.test.ts`

**Step 1: Write the failing test**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\__tests__\match-scorer.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildMatchPrompt } from "../match-scorer";

describe("buildMatchPrompt", () => {
  it("includes CV skills and job description in prompt", () => {
    const cvData = {
      skills: { technical: ["Python", "SQL"], soft: ["Communication"], languages: ["FR"] },
      experience: [{ title: "Analyst", company: "X", description: "Did analysis" }],
      summary: "Experienced analyst",
    };
    const jobDescription = "Looking for Python developer with SQL experience";

    const prompt = buildMatchPrompt(cvData, jobDescription);
    expect(prompt).toContain("Python");
    expect(prompt).toContain("SQL");
    expect(prompt).toContain("Looking for Python developer");
  });

  it("handles missing skills gracefully", () => {
    const cvData = {
      skills: { technical: [], soft: [], languages: [] },
      experience: [],
      summary: "",
    };
    const prompt = buildMatchPrompt(cvData, "Some job");
    expect(prompt).toBeDefined();
    expect(prompt.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/services/__tests__/match-scorer.test.ts
```

**Step 3: Implement match-scorer**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\match-scorer.ts`:
```typescript
import { callStructured } from "@/lib/api/openai";
import { MatchScoreSchema, type MatchScore } from "@/lib/schemas/ai-responses";

interface CvSummary {
  skills: { technical: string[]; soft: string[]; languages: string[] };
  experience: { title: string; company: string; description: string }[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a job matching expert. Analyze the candidate's CV against the job description.
Score the match from 0-100 in these categories: overall, skills, experience, education.
Be honest and precise. List matching skills, missing skills, strengths, and concerns.
Respond in the same language as the job description.`;

export function buildMatchPrompt(cvData: CvSummary, jobDescription: string): string {
  const skills = [
    ...cvData.skills.technical,
    ...cvData.skills.soft,
    ...cvData.skills.languages,
  ].join(", ") || "None listed";

  const experience = cvData.experience
    .map((e) => `${e.title} at ${e.company}: ${e.description}`)
    .join("\n") || "None listed";

  return `## Candidate CV Summary
${cvData.summary || "No summary available"}

### Skills
${skills}

### Experience
${experience}

---

## Job Description
${jobDescription}

---

Analyze the match between this candidate and this job.`;
}

export async function scoreMatch(
  cvData: CvSummary,
  jobDescription: string
): Promise<{ score: MatchScore; tokensUsed: number }> {
  const userPrompt = buildMatchPrompt(cvData, jobDescription);

  const result = await callStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: MatchScoreSchema,
    schemaName: "match_score",
  });

  return {
    score: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
  };
}
```

**Step 4: Implement cv-parser**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\cv-parser.ts`:
```typescript
import { callStructured } from "@/lib/api/openai";
import { ParsedResumeSchema, type ParsedResume } from "@/lib/schemas/ai-responses";

const SYSTEM_PROMPT = `You are a CV/resume parser. Extract structured information from the provided resume text.
Be thorough and accurate. Do not invent or assume information not present in the text.
The user has pasted their CV as plain text. Parse it into the requested structure.
Return the data in the exact JSON structure requested.`;

export async function parseCvText(
  rawText: string
): Promise<{ parsed: ParsedResume; tokensUsed: number }> {
  if (!rawText.trim()) throw new Error("CV text is empty");

  const result = await callStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Parse this CV:\n\n${rawText}`,
    schema: ParsedResumeSchema,
    schemaName: "parsed_resume",
  });

  return {
    parsed: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
  };
}
```

**Step 5: Implement cover-letter-generator with anti-hallucination**

Create `c:\Users\azizt\Workspace\jobpilot\src\lib\services\cover-letter-generator.ts`:
```typescript
import { callStructured } from "@/lib/api/openai";
import { CoverLetterResponseSchema, type CoverLetterResponse } from "@/lib/schemas/ai-responses";

interface GenerateOptions {
  cvSummary: string;
  cvSkills: string[];
  cvExperience: string;
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  language: "fr" | "en";
  tone: "professional" | "enthusiastic" | "creative" | "formal";
}

export interface CoverLetterResult {
  letter: CoverLetterResponse;
  tokensUsed: number;
  integrityWarnings: string[];
}

function checkIntegrity(letterText: string, cvSkills: string[], cvExperience: string): string[] {
  const warnings: string[] = [];
  const letterLower = letterText.toLowerCase();
  const cvContent = [
    ...cvSkills.map((s) => s.toLowerCase()),
    cvExperience.toLowerCase(),
  ].join(" ");

  const commonSkills = [
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "node", "sql", "nosql", "mongodb", "postgresql", "aws", "azure", "gcp",
    "docker", "kubernetes", "terraform", "ci/cd", "agile", "scrum",
    "machine learning", "deep learning", "tensorflow", "pytorch",
    "tableau", "power bi", "excel", "sas", "r", "scala", "spark",
  ];

  for (const skill of commonSkills) {
    if (letterLower.includes(skill) && !cvContent.includes(skill)) {
      warnings.push(`"${skill}" mentioned in cover letter but not found in CV`);
    }
  }

  return warnings;
}

export async function generateCoverLetter(
  options: GenerateOptions
): Promise<CoverLetterResult> {
  const systemPrompt = `You are an expert cover letter writer.
Write a personalized cover letter based on the candidate's real experience and skills.
CRITICAL RULE: NEVER invent experience, skills, or qualifications not present in the CV.
Only reorganize and emphasize existing relevant experience.
If the candidate lacks a required skill, do NOT mention it. Focus on transferable skills instead.
Language: ${options.language === "fr" ? "French" : "English"}.
Tone: ${options.tone}.`;

  const userPrompt = `## Candidate Profile
Summary: ${options.cvSummary}
Key Skills: ${options.cvSkills.join(", ")}
Experience: ${options.cvExperience}

## Target Job
Title: ${options.jobTitle}
Company: ${options.companyName}
Description: ${options.jobDescription}

Write a compelling cover letter for this specific job. ONLY reference skills and experience listed above.`;

  const result = await callStructured({
    systemPrompt,
    userPrompt,
    schema: CoverLetterResponseSchema,
    schemaName: "cover_letter",
  });

  const integrityWarnings = checkIntegrity(
    result.data.full_text,
    options.cvSkills,
    options.cvExperience
  );

  return {
    letter: result.data,
    tokensUsed: result.tokensInput + result.tokensOutput,
    integrityWarnings,
  };
}
```

**Step 6: Run tests**

```bash
npx vitest run src/lib/services/__tests__/match-scorer.test.ts
```

Expected: All PASS.

**Step 7: Commit**

```bash
git add src/lib/services/match-scorer.ts src/lib/services/cv-parser.ts src/lib/services/cover-letter-generator.ts src/lib/services/__tests__/
git commit -m "feat: add AI services - match scorer, CV parser, cover letter generator"
```

---

## Phase 4: UI Pages -- COMPLETE

> **Completed** using 5 parallel sub-agents for maximum efficiency.

### Implemented:
- **Login page**: Demo credentials (aziz@jobpilot.dev / demo), cookie-based session
- **Route groups**: `(app)` with sidebar for authenticated pages, `(auth)` centered for login
- **App layout**: Responsive sidebar + header + theme toggle (dark/light/system)
- **Dashboard**: Stats cards (new jobs, avg score, active apps, interviews) + top jobs + recent applications
- **Job listings**: Filters (source, remote, score) + search + job cards with actions
- **Applications pipeline**: Kanban board (8 statuses) + List view toggle
- **Settings**: 5 tabs (Profile, Search Preferences, CV Upload, Appearance, Notifications)
- **Notifications settings**: Search frequency (Manual/Daily/Weekly) + hour picker + email alerts placeholder
- **i18n**: Full FR/EN coverage for all UI text
- **Mock data**: Realistic data for all pages during prototype phase

### Key files:
- `src/app/[locale]/(app)/layout.tsx` - Sidebar + header layout
- `src/app/[locale]/(auth)/layout.tsx` - Centered auth layout
- `src/app/[locale]/(auth)/login/page.tsx` - Login form
- `src/app/api/auth/login/route.ts` - Auth API endpoint
- `src/components/layout/app-sidebar.tsx` - Navigation sidebar
- `src/components/dashboard/` - Stats, top jobs, recent applications
- `src/components/jobs/` - Job card, filters, list
- `src/components/applications/` - Kanban board, columns, cards, list view
- `src/components/settings/` - Profile, search, CV, appearance, notifications
- `src/lib/mock-data.ts` - Mock data for all components

---

## Phase 5: Supabase Integration -- COMPLETE

- [x] Connect Supabase (replace mock data)
- [x] Query layers (4 modules: applications, jobs, resumes, scores)
- [x] CRUD job listings (save, dismiss, restore)
- [x] Applications pipeline (create, update status, delete)
- [x] User profile (save/load preferences)
- [x] CV upload (Supabase Storage + AI parsing)
- [x] Dev seed endpoint (`/api/dev/seed`)
- [x] 139 unit tests (14 files)

---

## Phase 6: Auth + AI API Routes -- COMPLETE

- [x] Supabase Auth email/password (`@supabase/ssr`)
- [x] Auth utilities (server client, middleware client, browser client, getUser/requireUser)
- [x] Middleware rewrite (Supabase session + intl cookie merge)
- [x] Login/Signup/Logout/Callback routes
- [x] DB trigger profile auto-creation on signup
- [x] Dynamic userId migration (14 query functions, 5 API routes, 4 pages, 4 test files)
- [x] POST /api/ai/analyze-cv
- [x] POST /api/ai/match-score
- [x] POST /api/ai/cover-letter
- [x] /api/jobs/search (JSearch + Adzuna aggregation)
- [x] /api/applications (CRUD)

---

## Phase 7: Advanced Interactivity

- [ ] Drag-and-drop Kanban (dnd-kit)
- [ ] Auto-move pipeline on confirmed application
- [ ] Visual indicator for viewed jobs
- [ ] Dismissed jobs trash (restoration within 30-day TTL)
- [ ] Free keyword search

---

## Phase 8: Notifications + Email

- [ ] Responsive email templates (React Email)
- [ ] Resend integration
- [ ] Automatic search cron (daily/weekly based on user preference)
- [ ] New match alerts (configurable threshold, default 60/100)
- [ ] Alert threshold setting in Notifications tab (slider/select: 40, 50, 60, 70, 80)
- [ ] Application follow-up reminders
- [ ] Weekly summary report

---

## Phase 9: Deployment + Polish

- [ ] Vercel deployment
- [ ] Production environment variables
- [ ] Full E2E tests (Playwright)
- [ ] Performance audit
- [ ] CSV export for applications

---

## Verification Checklist

| Test | Command/Action | Expected |
|------|---------------|----------|
| Unit tests pass | `npm run test:run` | All green |
| Build succeeds | `npm run build` | No errors |
| Auth flow | Enter password on login page | Redirects to dashboard |
| Job search | Search "data analyst Montreal" | Results from JSearch + Adzuna, no duplicates |
| CV parse | Paste CV text, click Analyze | Parsed data displayed |
| Match scoring | Click Score on a job | Score 0-100 with explanation |
| Cover letter | Click Generate on a job | Personalized letter FR or EN |
| Anti-hallucination | Generate letter for job with skills not in CV | Warning banner |
| Kanban | Save job, drag in Kanban | Status changes, timeline updates |
| Email notification | Score >= user threshold (default 60) | Email received via Resend |
| i18n | Toggle FR/EN | All UI text changes |
| Cron | Trigger `/api/cron/fetch-jobs` | New listings appear |

---

## Cost Estimates (Monthly, Personal Use)

| Service | Cost |
|---------|------|
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier) |
| OpenAI (~200 scorings + 30 letters) | ~$0.30 |
| Resend (emails) | $0 (free: 100/day) |
| **Total** | **~$0.30/month** |

---

## Known Limitations (post-MVP)

| Limitation | Impact | Future Solution |
|------------|--------|----------------|
| Hash-based dedup | Misses same job with different titles | Fuzzy matching or semantic dedup via OpenAI |
| Adzuna free tier (2500/month) | Limits exploratory searches | 24h cache, prefer JSearch for exploration |
| Vercel cron 10s max (free) | No scoring in cron | Lazy scoring + external cron if needed |
| Keyword-based anti-hallucination | Misses subtle rephrasing | Semantic verification via OpenAI (post-MVP) |
