# Phase 8 - Notifications + Email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter le systeme complet de notifications email a JobPilot : templates React Email, envoi via Resend, cron automatique de recherche d'offres, alertes nouveaux matchs, rappels de suivi de candidatures, et rapport resume hebdomadaire.

**Architecture:** Service email centralize (`email-service.ts`) utilisant Resend + React Email pour le rendu. Cron routes Next.js protegees par `CRON_SECRET` pour declencher recherches et notifications. Preferences utilisateur stockees dans le JSONB `search_preferences` existant (pas de nouvelle table). Le cron fetch-only respecte la contrainte 10s du free tier Vercel. Les emails sont envoyes uniquement a `NOTIFY_EMAIL` (plan Resend gratuit = envoi uniquement a l'email du compte).

**Tech Stack:** Resend (v6.9.1, deja installe), @react-email/components (a installer), Next.js 16 API Routes, Vercel Cron (vercel.json), Vitest

---

## Context

Phases 1-7 sont terminees. L'UI notification dans Settings existe deja mais les email alerts sont en "Coming Soon" (`opacity-50 pointer-events-none`). `resend` est installe dans package.json mais aucun service email n'existe. Les variables RESEND_API_KEY, NOTIFY_EMAIL, CRON_SECRET sont dans `.env.example` mais pas dans `env.ts`. L'aggregateur de jobs (`job-aggregator.ts`) et le scorer (`match-scorer.ts`) existent et fonctionnent. Aucune route `/api/cron/*` n'existe.

## Contraintes cles

- **Vercel free tier** : cron max 10s execution. Le cron fait fetch-only (pas de scoring dans le cron).
- **Resend free tier** : envoi uniquement a l'email du compte (`aziztraorebf@gmail.com`). Max 100 emails/jour.
- **Sender** : `JobPilot <onboarding@resend.dev>` (free tier sans domaine custom).

## Dependances a installer

```bash
npm install @react-email/components -E
```

---

## Lots d'execution

```
Lot A (Tasks 1-3)  : Email service + templates          -> Build+Test -> Commit
Lot B (Tasks 4-5)  : Cron routes + vercel.json          -> Build+Test -> Commit
Lot C (Tasks 6-8)  : UI activation + alert settings     -> Build+Test -> Commit
Lot D (Task 9)     : Verification finale                 -> Commit
```

---

## Lot A : Email Service + React Email Templates

### Task 1: Installer @react-email/components + creer le service email

**Files:**
- Modify: `package.json` (install dep)
- Create: `src/lib/services/email-service.ts`
- Create: `src/lib/services/__tests__/email-service.test.ts`

**Step 1: Installer la dependance**

```bash
npm install @react-email/components -E
```

**Step 2: Ecrire le test pour le service email**

Creer `src/lib/services/__tests__/email-service.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail } from "../email-service";

// Mock Resend
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("NOTIFY_EMAIL", "test@example.com");
  });

  it("sends an email with subject and react component", async () => {
    const result = await sendEmail({
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe("test-id");
  });

  it("returns error when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendEmail({
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY");
  });

  it("returns error when NOTIFY_EMAIL is missing", async () => {
    vi.stubEnv("NOTIFY_EMAIL", "");
    const result = await sendEmail({
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("NOTIFY_EMAIL");
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm run test:run -- src/lib/services/__tests__/email-service.test.ts
```

Expected: FAIL - module not found.

**Step 4: Implementer le service email**

Creer `src/lib/services/email-service.ts` :

```typescript
import { Resend } from "resend";

const SENDER = "JobPilot <onboarding@resend.dev>";

interface SendEmailOptions {
  subject: string;
  html: string;
  react?: React.ReactElement;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    return { success: false, error: "NOTIFY_EMAIL is not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: SENDER,
      to: notifyEmail,
      subject: options.subject,
      ...(options.react ? { react: options.react } : { html: options.html }),
    });

    if (error) {
      return { success: false, error: `${error.name}: ${error.message}` };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
```

**Step 5: Run tests**

```bash
npm run test:run -- src/lib/services/__tests__/email-service.test.ts
```

Expected: All PASS.

---

### Task 2: Creer les 3 templates React Email

**Files:**
- Create: `src/emails/new-jobs-alert.tsx`
- Create: `src/emails/weekly-summary.tsx`
- Create: `src/emails/follow-up-reminder.tsx`

**Step 1: Creer le template New Jobs Alert**

`src/emails/new-jobs-alert.tsx` - Affiche les nouvelles offres matchant le profil au-dessus du seuil :

```tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Link,
  Preview,
} from "@react-email/components";

interface JobMatch {
  title: string;
  company: string;
  location: string | null;
  score: number;
  sourceUrl: string;
}

interface NewJobsAlertProps {
  jobs: JobMatch[];
  threshold: number;
  date: string;
}

export function NewJobsAlert({ jobs, threshold, date }: NewJobsAlertProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        {jobs.length} nouvelle(s) offre(s) au-dessus de {threshold}%
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nouvelles offres correspondantes</Heading>
          <Text style={subtitle}>
            {date} - {jobs.length} offre(s) avec un score &ge; {threshold}%
          </Text>
          <Hr style={hr} />
          {jobs.map((job, i) => (
            <Section key={i} style={jobCard}>
              <Text style={jobTitle}>
                <Link href={job.sourceUrl} style={link}>
                  {job.title}
                </Link>
              </Text>
              <Text style={jobMeta}>
                {job.company}
                {job.location ? ` - ${job.location}` : ""}
              </Text>
              <Text style={scoreBadge}>Score: {job.score}%</Text>
            </Section>
          ))}
          <Hr style={hr} />
          <Text style={footer}>
            JobPilot - Votre assistant de recherche d&apos;emploi
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NewJobsAlert;

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" };
const container = { margin: "0 auto", padding: "20px", maxWidth: "580px", backgroundColor: "#ffffff" };
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold" as const, margin: "0 0 12px" };
const subtitle = { color: "#6b7280", fontSize: "14px", margin: "0 0 20px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const jobCard = { padding: "12px 0" };
const jobTitle = { fontSize: "16px", fontWeight: "600" as const, margin: "0 0 4px" };
const link = { color: "#2563eb", textDecoration: "none" };
const jobMeta = { color: "#6b7280", fontSize: "14px", margin: "0 0 4px" };
const scoreBadge = { color: "#059669", fontSize: "13px", fontWeight: "bold" as const, margin: "0" };
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" as const };
```

**Step 2: Creer le template Weekly Summary**

`src/emails/weekly-summary.tsx` - Resume hebdomadaire avec stats :

```tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Preview,
} from "@react-email/components";

interface WeeklySummaryProps {
  weekOf: string;
  newJobsCount: number;
  appliedCount: number;
  interviewCount: number;
  avgScore: number;
  topJobs: { title: string; company: string; score: number }[];
}

export function WeeklySummary({
  weekOf,
  newJobsCount,
  appliedCount,
  interviewCount,
  avgScore,
  topJobs,
}: WeeklySummaryProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Resume hebdomadaire - Semaine du {weekOf}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Resume hebdomadaire</Heading>
          <Text style={subtitle}>Semaine du {weekOf}</Text>
          <Hr style={hr} />
          <Section style={statsRow}>
            <Text style={stat}>{newJobsCount} nouvelles offres</Text>
            <Text style={stat}>{appliedCount} candidatures</Text>
            <Text style={stat}>{interviewCount} entrevues</Text>
            <Text style={stat}>Score moyen: {avgScore}%</Text>
          </Section>
          <Hr style={hr} />
          {topJobs.length > 0 && (
            <>
              <Heading as="h2" style={h2}>Top offres de la semaine</Heading>
              {topJobs.map((job, i) => (
                <Text key={i} style={jobLine}>
                  {job.title} @ {job.company} - {job.score}%
                </Text>
              ))}
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            JobPilot - Votre assistant de recherche d&apos;emploi
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklySummary;

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" };
const container = { margin: "0 auto", padding: "20px", maxWidth: "580px", backgroundColor: "#ffffff" };
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold" as const, margin: "0 0 12px" };
const h2 = { color: "#1a1a2e", fontSize: "18px", fontWeight: "bold" as const, margin: "16px 0 8px" };
const subtitle = { color: "#6b7280", fontSize: "14px", margin: "0 0 20px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const statsRow = { padding: "0" };
const stat = { color: "#374151", fontSize: "15px", margin: "4px 0" };
const jobLine = { color: "#374151", fontSize: "14px", margin: "4px 0" };
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" as const };
```

**Step 3: Creer le template Follow-up Reminder**

`src/emails/follow-up-reminder.tsx` - Rappels pour candidatures sans reponse :

```tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Preview,
} from "@react-email/components";

interface StaleApplication {
  jobTitle: string;
  company: string;
  appliedDaysAgo: number;
  status: string;
}

interface FollowUpReminderProps {
  applications: StaleApplication[];
  date: string;
}

export function FollowUpReminder({ applications, date }: FollowUpReminderProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        {applications.length} candidature(s) a relancer
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Rappel de suivi</Heading>
          <Text style={subtitle}>
            {date} - Ces candidatures n&apos;ont pas eu de mise a jour recemment
          </Text>
          <Hr style={hr} />
          {applications.map((app, i) => (
            <Section key={i} style={appCard}>
              <Text style={appTitle}>{app.jobTitle}</Text>
              <Text style={appMeta}>
                {app.company} - {app.status} depuis {app.appliedDaysAgo} jours
              </Text>
            </Section>
          ))}
          <Hr style={hr} />
          <Text style={footer}>
            JobPilot - Votre assistant de recherche d&apos;emploi
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default FollowUpReminder;

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" };
const container = { margin: "0 auto", padding: "20px", maxWidth: "580px", backgroundColor: "#ffffff" };
const h1 = { color: "#1a1a2e", fontSize: "24px", fontWeight: "bold" as const, margin: "0 0 12px" };
const subtitle = { color: "#6b7280", fontSize: "14px", margin: "0 0 20px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const appCard = { padding: "8px 0" };
const appTitle = { fontSize: "15px", fontWeight: "600" as const, margin: "0 0 2px" };
const appMeta = { color: "#6b7280", fontSize: "13px", margin: "0" };
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" as const };
```

**Step 4: Run build**

```bash
npm run build
```

Expected: 0 errors.

---

### Task 3: Tests unitaires pour les templates email

**Files:**
- Create: `src/emails/__tests__/templates.test.tsx`

**Step 1: Ecrire les tests**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { NewJobsAlert } from "../new-jobs-alert";
import { WeeklySummary } from "../weekly-summary";
import { FollowUpReminder } from "../follow-up-reminder";

describe("NewJobsAlert template", () => {
  it("renders with jobs above threshold", async () => {
    const html = await render(
      NewJobsAlert({
        jobs: [
          { title: "Dev", company: "Acme", location: "Montreal", score: 85, sourceUrl: "https://example.com" },
        ],
        threshold: 60,
        date: "2026-02-06",
      })
    );
    expect(html).toContain("Dev");
    expect(html).toContain("Acme");
    expect(html).toContain("85%");
  });

  it("renders empty jobs list", async () => {
    const html = await render(
      NewJobsAlert({ jobs: [], threshold: 60, date: "2026-02-06" })
    );
    expect(html).toContain("0 offre(s)");
  });
});

describe("WeeklySummary template", () => {
  it("renders stats and top jobs", async () => {
    const html = await render(
      WeeklySummary({
        weekOf: "2026-02-03",
        newJobsCount: 15,
        appliedCount: 3,
        interviewCount: 1,
        avgScore: 72,
        topJobs: [{ title: "Analyst", company: "BigCo", score: 90 }],
      })
    );
    expect(html).toContain("15 nouvelles offres");
    expect(html).toContain("72%");
    expect(html).toContain("Analyst");
  });
});

describe("FollowUpReminder template", () => {
  it("renders stale applications", async () => {
    const html = await render(
      FollowUpReminder({
        applications: [
          { jobTitle: "Dev", company: "Acme", appliedDaysAgo: 14, status: "applied" },
        ],
        date: "2026-02-06",
      })
    );
    expect(html).toContain("Dev");
    expect(html).toContain("14 jours");
  });
});
```

**Step 2: Run tests**

```bash
npm run test:run -- src/emails/__tests__/templates.test.tsx
```

Expected: All PASS.

**Step 3: Run build + full test suite**

```bash
npm run test:run && npm run build
```

---

## Lot B : Cron Routes

### Task 4: Route cron fetch-jobs (recherche automatique)

**Files:**
- Create: `src/app/api/cron/fetch-jobs/route.ts`
- Create: `vercel.json`
- Modify: `src/lib/supabase/queries/profiles.ts` (ajouter `getProfilesWithAutoSearch`)

**Step 1: Ajouter la query `getProfilesWithAutoSearch`**

Dans `src/lib/supabase/queries/profiles.ts`, ajouter :

```typescript
/**
 * Fetch profiles that have automatic search enabled (daily or weekly).
 * Returns profiles where notification_frequency is not "manual".
 */
export async function getProfilesWithAutoSearch(): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(
      "search_preferences->notification_frequency.eq.daily," +
      "search_preferences->notification_frequency.eq.weekly"
    );

  if (error) {
    throw new Error(`Failed to fetch auto-search profiles: ${error.message}`);
  }

  return data ?? [];
}
```

Exporter depuis `src/lib/supabase/queries/index.ts`.

**Step 2: Creer la route cron**

`src/app/api/cron/fetch-jobs/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { aggregateJobSearch } from "@/lib/services/job-aggregator";
import { upsertJobs, getJobs } from "@/lib/supabase/queries";
import { getProfilesWithAutoSearch, getProfile } from "@/lib/supabase/queries";
import { getScoreMap } from "@/lib/supabase/queries";
import { sendEmail } from "@/lib/services/email-service";
import { render } from "@react-email/components";
import { NewJobsAlert } from "@/emails/new-jobs-alert";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    if (profiles.length === 0) {
      return NextResponse.json({ message: "No profiles with auto-search", fetched: 0 });
    }

    let totalInserted = 0;

    for (const profile of profiles) {
      const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
      const keywords = (prefs.keywords as string[] | undefined) ?? [];
      const locations = (prefs.locations as string[] | undefined) ?? [];
      const threshold = (prefs.alert_threshold as number | undefined) ?? 60;

      if (keywords.length === 0) continue;

      const query = keywords.join(" ");
      const location = locations[0] ?? "Canada";

      // Fetch new jobs
      const result = await aggregateJobSearch({ keywords: query, location });
      if (result.jobs.length === 0) continue;

      // Upsert into DB
      const inserted = await upsertJobs(result.jobs);
      totalInserted += inserted.length;

      // Check for high-scoring jobs to notify about
      if (inserted.length > 0) {
        const insertedIds = inserted.map((j) => j.id);
        const scores = await getScoreMap(profile.id, insertedIds);
        const highScoreJobs = inserted
          .filter((j) => (scores[j.id] ?? 0) >= threshold)
          .map((j) => ({
            title: j.title,
            company: j.company_name ?? "Unknown",
            location: j.location,
            score: scores[j.id] ?? 0,
            sourceUrl: j.source_url,
          }));

        if (highScoreJobs.length > 0) {
          const html = await render(
            NewJobsAlert({
              jobs: highScoreJobs,
              threshold,
              date: new Date().toISOString().split("T")[0],
            })
          );

          await sendEmail({
            subject: `[JobPilot] ${highScoreJobs.length} nouvelle(s) offre(s) correspondante(s)`,
            html,
          });
        }
      }
    }

    return NextResponse.json({ message: "Cron completed", fetched: totalInserted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron fetch-jobs]", message);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
```

**Step 3: Creer vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/fetch-jobs",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/notifications",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

Le cron `fetch-jobs` tourne chaque jour a 8h UTC.
Le cron `notifications` (weekly summary + follow-up reminders) tourne chaque lundi a 9h UTC.

**Step 4: Run build**

```bash
npm run build
```

---

### Task 5: Route cron notifications (weekly summary + follow-up)

**Files:**
- Create: `src/app/api/cron/notifications/route.ts`
- Modify: `src/lib/supabase/queries/applications.ts` (ajouter `getStaleApplications`)

**Step 1: Ajouter `getStaleApplications` dans applications.ts**

Dans `src/lib/supabase/queries/applications.ts`, ajouter une fonction qui retourne les candidatures en statut "applied" sans mise a jour depuis N jours :

```typescript
/**
 * Fetch applications that haven't been updated in the given number of days.
 * Returns applications in "applied" or "interview" status only.
 */
export async function getStaleApplications(
  userId: string,
  staleDays: number = 14
): Promise<ApplicationWithJob[]> {
  const supabase = getSupabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const { data, error } = await supabase
    .from("applications")
    .select("*, job_listings(*)")
    .eq("user_id", userId)
    .in("status", ["applied", "interview"])
    .lt("updated_at", cutoff.toISOString())
    .order("updated_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch stale applications: ${error.message}`);
  }

  return (data ?? []) as ApplicationWithJob[];
}
```

Exporter depuis `src/lib/supabase/queries/index.ts`.

**Step 2: Ajouter `getWeeklyStats` dans applications.ts**

```typescript
/**
 * Get application stats for the past N days.
 */
export async function getWeeklyStats(
  userId: string,
  days: number = 7
): Promise<{ appliedCount: number; interviewCount: number }> {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("applications")
    .select("status")
    .eq("user_id", userId)
    .gte("updated_at", since.toISOString());

  if (error) {
    throw new Error(`Failed to fetch weekly stats: ${error.message}`);
  }

  const rows = data ?? [];
  return {
    appliedCount: rows.filter((r) => r.status === "applied").length,
    interviewCount: rows.filter((r) => r.status === "interview").length,
  };
}
```

**Step 3: Creer la route cron notifications**

`src/app/api/cron/notifications/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { render } from "@react-email/components";
import { getProfilesWithAutoSearch } from "@/lib/supabase/queries";
import { getStaleApplications, getWeeklyStats } from "@/lib/supabase/queries";
import { getJobs, getScoreMap } from "@/lib/supabase/queries";
import { sendEmail } from "@/lib/services/email-service";
import { WeeklySummary } from "@/emails/weekly-summary";
import { FollowUpReminder } from "@/emails/follow-up-reminder";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await getProfilesWithAutoSearch();
    let emailsSent = 0;

    for (const profile of profiles) {
      const prefs = (profile.search_preferences ?? {}) as Record<string, unknown>;
      const frequency = (prefs.notification_frequency as string | undefined) ?? "manual";

      // Weekly summary (only for weekly or daily users)
      if (frequency === "weekly" || frequency === "daily") {
        const stats = await getWeeklyStats(profile.id, 7);
        const recentJobs = await getJobs({ limit: 50 });
        const jobIds = recentJobs.map((j) => j.id);
        const scores = await getScoreMap(profile.id, jobIds);
        const avgScore = jobIds.length > 0
          ? Math.round(
              jobIds.reduce((sum, id) => sum + (scores[id] ?? 0), 0) / jobIds.length
            )
          : 0;

        const topJobs = recentJobs
          .filter((j) => (scores[j.id] ?? 0) >= 60)
          .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
          .slice(0, 5)
          .map((j) => ({
            title: j.title,
            company: j.company_name ?? "Unknown",
            score: scores[j.id] ?? 0,
          }));

        const weekOf = new Date().toISOString().split("T")[0];

        const summaryHtml = await render(
          WeeklySummary({
            weekOf,
            newJobsCount: recentJobs.length,
            appliedCount: stats.appliedCount,
            interviewCount: stats.interviewCount,
            avgScore,
            topJobs,
          })
        );

        await sendEmail({
          subject: `[JobPilot] Resume hebdomadaire - ${weekOf}`,
          html: summaryHtml,
        });
        emailsSent++;
      }

      // Follow-up reminders (for all non-manual users)
      const staleApps = await getStaleApplications(profile.id, 14);
      if (staleApps.length > 0) {
        const now = new Date();
        const apps = staleApps.map((app) => {
          const appliedDate = app.applied_at ? new Date(app.applied_at) : new Date(app.saved_at);
          const daysAgo = Math.floor((now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            jobTitle: app.job_listings?.title ?? "Sans titre",
            company: app.job_listings?.company_name ?? "Inconnu",
            appliedDaysAgo: daysAgo,
            status: app.status,
          };
        });

        const reminderHtml = await render(
          FollowUpReminder({
            applications: apps,
            date: new Date().toISOString().split("T")[0],
          })
        );

        await sendEmail({
          subject: `[JobPilot] ${apps.length} candidature(s) a relancer`,
          html: reminderHtml,
        });
        emailsSent++;
      }
    }

    return NextResponse.json({ message: "Notifications sent", emailsSent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron notifications]", message);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
```

**Step 4: Ecrire les tests pour getStaleApplications et getWeeklyStats**

Ajouter dans `src/lib/supabase/queries/__tests__/applications.test.ts` :

```typescript
describe("getStaleApplications", () => {
  it("fetches applications older than staleDays in applied/interview status", async () => {
    // ... mock Supabase with .lt and .in filters
  });
});

describe("getWeeklyStats", () => {
  it("counts applied and interview applications from last N days", async () => {
    // ... mock Supabase with .gte filter
  });
});
```

**Step 5: Run build + tests**

```bash
npm run test:run && npm run build
```

---

## Lot C : UI Activation + Alert Settings

### Task 6: Activer les email alerts dans le UI

**Files:**
- Modify: `src/components/settings/notification-settings.tsx:123-160`
- Modify: `src/components/settings/settings-page-client.tsx:16-25`
- Modify: `src/app/api/profile/route.ts:9-18`

**Step 1: Ajouter les champs email alerts au schema**

Dans `src/components/settings/settings-page-client.tsx`, ajouter a `SearchPreferencesData` :

```typescript
export interface SearchPreferencesData {
  // ... champs existants ...
  alert_new_jobs?: boolean;
  alert_follow_up?: boolean;
  alert_weekly_summary?: boolean;
}
```

Dans `src/app/api/profile/route.ts`, ajouter au `SearchPreferencesSchema` :

```typescript
const SearchPreferencesSchema = z.object({
  // ... champs existants ...
  alert_new_jobs: z.boolean().optional(),
  alert_follow_up: z.boolean().optional(),
  alert_weekly_summary: z.boolean().optional(),
});
```

**Step 2: Activer les checkboxes dans notification-settings.tsx**

Retirer le `opacity-50 pointer-events-none` et le badge "Coming Soon". Remplacer les checkboxes HTML natifs par des composants shadcn/ui `Checkbox`. Connecter les etats aux preferences et sauvegarder via l'API existante.

Key changes dans `notification-settings.tsx` :
- Ajouter `import { Checkbox } from "@/components/ui/checkbox";`
- Ajouter 3 states: `alertNewJobs`, `alertFollowUp`, `alertWeeklySummary` initialises depuis `searchPreferences`
- Retirer `opacity-50 pointer-events-none` de la div (ligne 137)
- Retirer le `<Badge>` "Coming Soon" (lignes 130-132)
- Remplacer `<input type="checkbox">` par `<Checkbox>` shadcn
- Inclure les 3 alert booleans dans le payload `handleSave`

**Step 3: Ajouter le slider/select seuil d'alerte**

Ajouter un select pour `alert_threshold` (40, 50, 60, 70, 80) dans la section email alerts, visible quand `alertNewJobs` est active.

Cles i18n a ajouter dans `messages/fr.json` et `messages/en.json` :

```json
"alertThreshold": "Seuil d'alerte",
"alertThresholdDescription": "Score minimum pour recevoir une notification",
"thresholdValue": "Score minimum: {value}%"
```

**Step 4: Run build**

```bash
npm run build
```

---

### Task 7: Ajouter les cles i18n manquantes

**Files:**
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

**Step 1: Ajouter les cles**

Dans la section `settings` de `messages/fr.json` :

```json
"alertThreshold": "Seuil d'alerte",
"alertThresholdDescription": "Score minimum pour declencher une notification email",
"notificationConfigured": "Notifications configurees"
```

Dans la section `settings` de `messages/en.json` :

```json
"alertThreshold": "Alert threshold",
"alertThresholdDescription": "Minimum score to trigger an email notification",
"notificationConfigured": "Notifications configured"
```

**Step 2: Verifier qu'il n'y a pas de cles manquantes**

Chercher tous les appels `t("...")` dans les composants modifies et verifier que chaque cle existe dans les deux fichiers de messages.

**Step 3: Run build**

```bash
npm run build
```

---

### Task 8: Tests pour les cron routes + queries

**Files:**
- Create: `src/lib/supabase/queries/__tests__/profiles-auto-search.test.ts`
- Modify: `src/lib/supabase/queries/__tests__/applications.test.ts`

**Step 1: Tests pour getProfilesWithAutoSearch**

```typescript
describe("getProfilesWithAutoSearch", () => {
  it("fetches profiles with daily or weekly notification frequency", async () => {
    // Mock supabase .or() filter
  });

  it("returns empty array when no profiles have auto-search", async () => {
    // Mock empty result
  });
});
```

**Step 2: Tests pour getStaleApplications**

```typescript
describe("getStaleApplications", () => {
  it("returns applications in applied/interview status older than staleDays", async () => {
    // Mock with .lt and .in
  });

  it("returns empty array when no stale applications", async () => {
    // Mock empty result
  });
});
```

**Step 3: Tests pour getWeeklyStats**

```typescript
describe("getWeeklyStats", () => {
  it("counts applied and interview statuses from recent period", async () => {
    // Mock with status filter
  });
});
```

**Step 4: Run full test suite + build**

```bash
npm run test:run && npm run build
```

---

## Lot D : Verification Finale

### Task 9: Build + tests complets + hostile review

**Step 1: Run full test suite**

```bash
npm run test:run
```

Expected: tous les tests passent (~150+)

**Step 2: Run build**

```bash
npm run build
```

Expected: 0 erreurs

**Step 3: Verification Playwright (visuelle)**

Lancer `npm run dev` et verifier avec Playwright :
- [ ] Settings > Notifications : checkboxes email alerts actives (plus "Coming Soon")
- [ ] Settings > Notifications : seuil d'alerte visible quand "Nouvelles offres" coche
- [ ] Settings > Notifications : sauvegarde fonctionne (toast succes)
- [ ] Dark mode : Settings notifications fonctionne
- [ ] Mobile : Settings notifications responsive
- [ ] Console errors : 0

**Step 4: Test cron local**

Tester les routes cron manuellement :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/fetch-jobs
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/notifications
```

Verifier :
- [ ] fetch-jobs retourne `{ message: "Cron completed", fetched: N }`
- [ ] notifications retourne `{ message: "Notifications sent", emailsSent: N }`
- [ ] Email recu dans la boite gmail (si RESEND_API_KEY configure)
- [ ] Pas d'erreurs dans les logs console

**Step 5: Hostile review checklist**

- [ ] Aucun `any` type
- [ ] CRON_SECRET verifie dans chaque route cron
- [ ] Pas de secrets hardcodes
- [ ] Templates email ne contiennent pas de donnees sensibles
- [ ] Rollback gracieux si l'envoi d'email echoue (le cron continue)
- [ ] i18n complet (pas de texte hardcode dans le UI)
- [ ] Aucune regression sur les tests existants
- [ ] vercel.json syntaxe valide
- [ ] Resend sender = `onboarding@resend.dev` (free tier)

**Step 6: Commit final**

```bash
git add -A
git commit -m "feat: phase 8 complete - email notifications, cron jobs, React Email templates"
```

---

## Fichiers cles a modifier (resume)

| Fichier | Action | Lot |
|---------|--------|-----|
| `package.json` | +@react-email/components | A |
| `src/lib/services/email-service.ts` | **NEW** - service envoi email | A |
| `src/lib/services/__tests__/email-service.test.ts` | **NEW** - tests service email | A |
| `src/emails/new-jobs-alert.tsx` | **NEW** - template React Email | A |
| `src/emails/weekly-summary.tsx` | **NEW** - template React Email | A |
| `src/emails/follow-up-reminder.tsx` | **NEW** - template React Email | A |
| `src/emails/__tests__/templates.test.tsx` | **NEW** - tests templates | A |
| `src/app/api/cron/fetch-jobs/route.ts` | **NEW** - cron recherche auto | B |
| `src/app/api/cron/notifications/route.ts` | **NEW** - cron weekly+follow-up | B |
| `vercel.json` | **NEW** - cron schedule | B |
| `src/lib/supabase/queries/profiles.ts` | +getProfilesWithAutoSearch | B |
| `src/lib/supabase/queries/applications.ts` | +getStaleApplications, +getWeeklyStats | B |
| `src/components/settings/notification-settings.tsx` | Enable email alerts | C |
| `src/components/settings/settings-page-client.tsx` | +alert boolean fields | C |
| `src/app/api/profile/route.ts` | +alert booleans in schema | C |
| `messages/fr.json` | +nouvelles cles | C |
| `messages/en.json` | +nouvelles cles | C |

## Parallelisme possible

- **Lot A**: Tasks 1 et 2 sont independantes (service email vs templates). Task 3 depend des deux.
- **Lot B**: Tasks 4 et 5 sont partiellement independantes (fetch-jobs vs notifications), mais partagent `getProfilesWithAutoSearch`.
- **Lot C**: Tasks 6, 7 sont independantes. Task 8 depend de tout.
