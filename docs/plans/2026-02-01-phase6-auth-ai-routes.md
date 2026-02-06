# Phase 6: Supabase Auth + AI API Routes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace demo login with Supabase Auth (email/password) and add 3 AI API routes (analyze-cv, match-score, cover-letter).

**Architecture:** Dual Client approach - auth client (`@supabase/ssr` + ANON_KEY) for authentication, existing data client (`getSupabase()` + SERVICE_ROLE_KEY) for DB queries. No RLS migration. USER_ID constant replaced by dynamic `user.id` from auth session.

**Tech Stack:** `@supabase/ssr`, `@supabase/supabase-js@^2.93.3`, Next.js 16 App Router, Zod, Vitest

---

## Task 1: Install @supabase/ssr + add i18n keys

**Files:**
- Modify: `package.json`
- Modify: `messages/en.json:18-27` (auth section)
- Modify: `messages/fr.json:18-27` (auth section)

**Step 1: Install package**

Run: `npm install @supabase/ssr`
Expected: Package added to dependencies

**Step 2: Update en.json auth section**

Replace lines 18-27 of `messages/en.json`:
```json
"auth": {
  "login": "Sign in",
  "signup": "Sign up",
  "email": "Email",
  "password": "Password",
  "confirmPassword": "Confirm password",
  "fullName": "Full name",
  "logout": "Sign out",
  "loginDescription": "Sign in to access your workspace",
  "signupDescription": "Create your account",
  "invalidCredentials": "Invalid email or password",
  "networkError": "Server connection error",
  "passwordMismatch": "Passwords do not match",
  "passwordTooShort": "Password must be at least 8 characters",
  "signupSuccess": "Account created! Check your email to confirm.",
  "alreadyHaveAccount": "Already have an account?",
  "noAccount": "Don't have an account?",
  "signingIn": "Signing in...",
  "signingUp": "Creating account..."
}
```

**Step 3: Update fr.json auth section**

Replace lines 18-27 of `messages/fr.json`:
```json
"auth": {
  "login": "Se connecter",
  "signup": "Creer un compte",
  "email": "Courriel",
  "password": "Mot de passe",
  "confirmPassword": "Confirmer le mot de passe",
  "fullName": "Nom complet",
  "logout": "Se deconnecter",
  "loginDescription": "Connectez-vous pour acceder a votre espace",
  "signupDescription": "Creez votre compte",
  "invalidCredentials": "Courriel ou mot de passe invalide",
  "networkError": "Erreur de connexion au serveur",
  "passwordMismatch": "Les mots de passe ne correspondent pas",
  "passwordTooShort": "Le mot de passe doit contenir au moins 8 caracteres",
  "signupSuccess": "Compte cree ! Verifiez votre courriel pour confirmer.",
  "alreadyHaveAccount": "Vous avez deja un compte ?",
  "noAccount": "Pas encore de compte ?",
  "signingIn": "Connexion...",
  "signingUp": "Creation du compte..."
}
```

**Step 4: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add package.json package-lock.json messages/en.json messages/fr.json
git commit -m "feat(phase6): install @supabase/ssr + auth i18n keys"
```

---

## Task 2: Auth client utilities + getUser helper

**Files:**
- Create: `src/lib/supabase/auth-server.ts`
- Create: `src/lib/supabase/auth-middleware.ts`
- Create: `src/lib/supabase/browser-client.ts`
- Create: `src/lib/supabase/get-user.ts`

**Step 1: Create server auth client factory**

Create `src/lib/supabase/auth-server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can be called from Server Components where cookies are read-only.
          // This is expected - the middleware handles the refresh.
        }
      },
    },
  });
}
```

**Step 2: Create middleware auth client factory**

Create `src/lib/supabase/auth-middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export function createMiddlewareClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response: () => response };
}
```

Note: `response` is returned as a getter function `() => response` because `setAll` reassigns `response`. The caller must call `response()` AFTER `supabase.auth.getUser()` to get the response with refreshed cookies.

**Step 3: Create browser auth client factory**

Create `src/lib/supabase/browser-client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function getAuthBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient<Database>(url, key);
}
```

**Step 4: Create getUser helper**

Create `src/lib/supabase/get-user.ts`:
```typescript
import { createAuthClient } from "./auth-server";
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
  if (!user) throw new Error("Unauthorized");
  return user;
}
```

**Step 5: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 6: Commit**

```bash
git add src/lib/supabase/auth-server.ts src/lib/supabase/auth-middleware.ts src/lib/supabase/browser-client.ts src/lib/supabase/get-user.ts
git commit -m "feat(phase6): auth client utilities + getUser helper"
```

---

## Task 3: Middleware update

**Files:**
- Modify: `src/middleware.ts` (full rewrite)

**Step 1: Rewrite middleware**

Replace entire `src/middleware.ts`:
```typescript
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createMiddlewareClient } from "./lib/supabase/auth-middleware";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: skip intl middleware entirely
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Auth callback: no locale prefix, no auth check
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  // Public auth pages: login and signup (allow without session)
  const isPublicAuthPage =
    pathname.includes("/login") || pathname.includes("/signup");
  if (isPublicAuthPage) {
    return intlMiddleware(request);
  }

  // Refresh Supabase auth session via middleware client
  const { supabase, response: getResponse } = createMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated: apply intl middleware
  const intlResponse = intlMiddleware(request);

  // Copy Supabase auth cookies (refreshed tokens) into intl response
  const supabaseResponse = getResponse();
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

Key points:
- Uses `getUser()` not `getSession()` (more secure, validates JWT server-side)
- `getResponse()` called AFTER `getUser()` to get response with refreshed cookies
- Supabase cookies merged into intl response

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(phase6): middleware uses Supabase auth session"
```

---

## Task 4: Login page + signup page + logout + callback

**Files:**
- Modify: `src/app/[locale]/(auth)/login/page.tsx` (full rewrite)
- Create: `src/app/[locale]/(auth)/signup/page.tsx`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/auth/callback/route.ts`
- Delete: `src/app/api/auth/login/route.ts`
- Delete: `src/lib/auth.ts`
- Modify: `src/components/layout/app-sidebar.tsx:92-108` (add logout button)

**Step 1: Rewrite login page**

Replace entire `src/app/[locale]/(auth)/login/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = getAuthBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(t("invalidCredentials"));
        return;
      }

      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex items-center gap-2">
          <Compass className="size-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">JobPilot</span>
        </div>
        <CardTitle className="text-2xl">{t("login")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? t("signingIn") : t("login")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href={`/${locale}/signup`}
              className="font-medium text-primary hover:underline"
            >
              {t("signup")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create signup page**

Create `src/app/[locale]/(auth)/signup/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthBrowserClient } from "@/lib/supabase/browser-client";

export default function SignupPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const supabase = getAuthBrowserClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(t("signupSuccess"));
      setTimeout(() => {
        router.push(`/${locale}/login`);
      }, 2000);
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex items-center gap-2">
          <Compass className="size-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">JobPilot</span>
        </div>
        <CardTitle className="text-2xl">{t("signup")}</CardTitle>
        <CardDescription>{t("signupDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? t("signingUp") : t("signup")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("alreadyHaveAccount")}{" "}
            <Link
              href={`/${locale}/login`}
              className="font-medium text-primary hover:underline"
            >
              {t("login")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create logout route**

Create `src/app/api/auth/logout/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

export async function POST() {
  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[API] Logout error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Logout failed";
    console.error("[API] POST /api/auth/logout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 4: Create auth callback route**

Create `src/app/auth/callback/route.ts` (NOT under `[locale]`):
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/fr/dashboard";

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/fr/login", request.url));
}
```

**Step 5: Add logout button to sidebar**

In `src/components/layout/app-sidebar.tsx`, replace the user info section (lines 92-108) with:
```typescript
      {/* User info + logout at bottom */}
      <div className="border-t px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {(userInitials ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{userName ?? ""}</span>
              <span className="text-xs text-muted-foreground truncate">
                {userEmail ?? ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={t("logout")}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
```

The `SidebarContent` component needs new props and a logout handler. Full updated props:
```typescript
interface SidebarContentProps {
  onNavigate?: () => void;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}
```

Add to imports: `LogOut` from lucide-react.
Add `useTranslations("auth")` for `t("logout")`.
Add the logout handler:
```typescript
const router = useRouter();

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  router.push(`/${locale}/login`);
  router.refresh();
}
```

The `AppSidebar` component and `AppLayout` need to pass user info. Since `AppSidebar` is a client component and `AppLayout` is a server component, pass user data via props from layout:

Update `src/app/[locale]/(app)/layout.tsx`:
```typescript
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { getUser } from "@/lib/supabase/get-user";

type Props = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: Props) {
  const user = await getUser();
  const userName = (user?.user_metadata?.full_name as string) ?? "";
  const userEmail = user?.email ?? "";
  const initials = userName
    ? userName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
    : userEmail.slice(0, 2);

  return (
    <div className="flex h-screen">
      <AppSidebar userName={userName} userEmail={userEmail} userInitials={initials} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

Update `AppSidebar` export to accept and pass props:
```typescript
interface AppSidebarProps {
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

export function AppSidebar({ userName, userEmail, userInitials }: AppSidebarProps) {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
      <SidebarContent userName={userName} userEmail={userEmail} userInitials={userInitials} />
    </aside>
  );
}
```

**Step 6: Delete old auth files**

Delete: `src/app/api/auth/login/route.ts`
Delete: `src/lib/auth.ts`

**Step 7: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(phase6): login/signup/logout with Supabase Auth"
```

---

## Task 5: DB trigger for profile creation on signup

**Files:**
- Create migration via Supabase MCP: `003_auth_profile_trigger.sql`

**Step 1: Apply migration**

Use Supabase MCP `apply_migration`:
```sql
-- Create a function that inserts a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

-- Fire after every INSERT on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

**Step 2: Verify trigger works**

Run SQL via Supabase MCP `execute_sql`:
```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```
Expected: One row showing the trigger on `auth.users`

**Step 3: Commit migration file**

If using local migration files:
```bash
git add supabase/migrations/
git commit -m "feat(phase6): DB trigger for profile creation on signup"
```

---

## Task 6: Replace USER_ID in query functions

**Files:**
- Modify: `src/lib/supabase/queries/applications.ts:2,82,126-137,243-278`
- Modify: `src/lib/supabase/queries/jobs.ts:2,193-210,244-251`
- Modify: `src/lib/supabase/queries/scores.ts:2,14-16,43-45,89-92`
- Modify: `src/lib/supabase/queries/resumes.ts:2,15,35,54,73,91-99`
- Modify: `src/lib/supabase/queries/index.ts` (re-exports unchanged)
- Modify: `src/lib/supabase/constants.ts:1-3` (update comment)

This is the largest task. The pattern is consistent: add `userId: string` as the first parameter to every function that currently imports `USER_ID`, then replace `USER_ID` with `userId` in the body.

**Step 1: Update applications.ts**

Changes:
- Remove `import { USER_ID } from "@/lib/supabase/constants";` (line 2)
- `getApplications()` -> `getApplications(userId: string)` -- replace `USER_ID` with `userId` on line 87
- `createApplication(jobListingId)` -> `createApplication(userId: string, jobListingId: string)` -- replace `USER_ID` with `userId` on line 137
- `getApplicationStats()` -> `getApplicationStats(userId: string)` -- replace `USER_ID` with `userId` on lines 257, 264, 278

**Step 2: Update jobs.ts**

Changes:
- Remove `import { USER_ID } from "@/lib/supabase/constants";` (line 2)
- `dismissJob(jobListingId)` -> `dismissJob(userId: string, jobListingId: string)` -- replace `USER_ID` with `userId` on lines 201, 210
- `getDismissedJobIds()` -> `getDismissedJobIds(userId: string)` -- replace `USER_ID` with `userId` on line 250

**Step 3: Update scores.ts**

Changes:
- Remove `import { USER_ID } from "@/lib/supabase/constants";` (line 2)
- `getScoreMap(jobIds)` -> `getScoreMap(userId: string, jobIds: string[])` -- replace `USER_ID` with `userId` on line 25
- `getScoresForJobs(jobIds)` -> `getScoresForJobs(userId: string, jobIds: string[])` -- replace `USER_ID` with `userId` on line 54
- `getScoreForJob(jobId, resumeId)` -> `getScoreForJob(userId: string, jobId: string, resumeId: string)` -- replace `USER_ID` with `userId` on line 97

**Step 4: Update resumes.ts**

Changes:
- Remove `import { USER_ID } from "@/lib/supabase/constants";` (line 2)
- `getPrimaryResume()` -> `getPrimaryResume(userId: string)` -- replace on line 20
- `getResumeById(id)` -> `getResumeById(userId: string, id: string)` -- replace on line 41
- `getResumes()` -> `getResumes(userId: string)` -- replace on line 59
- `unsetAllPrimaries()` -> `unsetAllPrimaries(userId: string)` -- replace on line 78
- `createResume(data)` -> `createResume(userId: string, data: ResumeInsert)` -- replace `{ ...data, user_id: USER_ID }` with `{ ...data, user_id: userId }` on line 99
- Pass `userId` to `unsetAllPrimaries(userId)` calls on lines 93 and 120

**Step 5: Update constants.ts**

Replace content of `src/lib/supabase/constants.ts`:
```typescript
// Hardcoded profile UUID used ONLY by seed.ts and integration tests.
// Production code gets userId from Supabase Auth session via get-user.ts.
export const USER_ID = "126d2d02-c032-49b0-a2c8-8a7034b6512f";
```

**Step 6: Verify build fails (callers not yet updated)**

Run: `npx next build`
Expected: TypeScript errors in callers (pages + API routes) - this is correct, we fix them in the next step.

**Step 7: Commit query changes**

```bash
git add src/lib/supabase/queries/ src/lib/supabase/constants.ts
git commit -m "feat(phase6): parameterize userId in all query functions"
```

---

## Task 7: Update all callers (API routes + pages)

**Files:**
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/applications/route.ts`
- Modify: `src/app/api/jobs/dismiss/route.ts`
- Modify: `src/app/api/resumes/upload/route.ts`
- Modify: `src/app/api/resumes/[id]/route.ts`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`
- Modify: `src/app/[locale]/(app)/jobs/page.tsx`
- Modify: `src/app/[locale]/(app)/applications/page.tsx`
- Modify: `src/app/[locale]/(app)/settings/page.tsx`

**Pattern for API routes:** Replace `import { USER_ID } from "@/lib/supabase/constants"` with `import { requireUser } from "@/lib/supabase/get-user"`, then `const user = await requireUser()` at start of handler, pass `user.id` to query functions.

**Pattern for pages:** Add `import { requireUser } from "@/lib/supabase/get-user"`, then `const user = await requireUser()` at start of component, pass `user.id` to query functions.

**Step 1: Update api/profile/route.ts**

- Remove: `import { USER_ID } from "@/lib/supabase/constants";`
- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- In `GET()`: add `const user = await requireUser();` then `getProfile(user.id)`
- In `PATCH()`: add `const user = await requireUser();` then `updateProfile(user.id, body)`

**Step 2: Update api/applications/route.ts**

- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- In `POST()`: add `const user = await requireUser();` then `createApplication(user.id, body.jobListingId)`

**Step 3: Update api/jobs/dismiss/route.ts**

- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- In `POST()`: add `const user = await requireUser();` then `dismissJob(user.id, body.jobListingId)`

**Step 4: Update api/resumes/upload/route.ts**

- Remove: `import { USER_ID } from "@/lib/supabase/constants";`
- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- In `POST()`: add `const user = await requireUser();`
- Replace `USER_ID` with `user.id` on storage path line and `createResume(user.id, {...})` call

**Step 5: Update api/resumes/[id]/route.ts**

- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- In `DELETE()`: add `const user = await requireUser();` then `getResumeById(user.id, id)`

**Step 6: Update dashboard/page.tsx**

- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- Add `const user = await requireUser();` after translations
- Change to: `getApplicationStats(user.id)`, `getApplications(user.id)`, `getScoreMap(user.id, jobIds)`

**Step 7: Update jobs/page.tsx**

- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- Add `const user = await requireUser();`
- Change to: `getDismissedJobIds(user.id)`, `getScoreMap(user.id, jobIds)`

**Step 8: Update applications/page.tsx**

- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- Add `const user = await requireUser();`
- Change to: `getApplications(user.id)`, `getScoreMap(user.id, jobIds)`

**Step 9: Update settings/page.tsx**

- Remove: `import { USER_ID } from "@/lib/supabase/constants";`
- Add: `import { requireUser } from "@/lib/supabase/get-user";`
- Add `const user = await requireUser();`
- Change to: `getProfile(user.id)`, `getResumes(user.id)`
- Replace `USER_ID` in fallback profile with `user.id`

**Step 10: Verify build**

Run: `npx next build`
Expected: Compiles successfully, 0 errors

**Step 11: Commit**

```bash
git add src/app/
git commit -m "feat(phase6): all callers use dynamic userId from auth session"
```

---

## Task 8: Update unit tests

**Files:**
- Modify: `src/lib/supabase/queries/__tests__/applications.test.ts`
- Modify: `src/lib/supabase/queries/__tests__/jobs.test.ts`
- Modify: `src/lib/supabase/queries/__tests__/scores.test.ts`
- Modify: `src/lib/supabase/queries/__tests__/resumes.test.ts`

**Pattern for all 4 files:**
1. Remove: `vi.mock("@/lib/supabase/constants", () => ({ USER_ID: "test-user-id-1234" }));`
2. Define: `const TEST_USER_ID = "test-user-id-1234";`
3. Pass `TEST_USER_ID` as first arg to every function call that now requires it

**Step 1: Update applications.test.ts**

- Remove the `vi.mock("@/lib/supabase/constants"...)` block
- Add `const TEST_USER_ID = "test-user-id-1234";`
- `getApplications()` -> `getApplications(TEST_USER_ID)`
- `createApplication("job-1")` -> `createApplication(TEST_USER_ID, "job-1")`
- `getApplicationStats()` -> `getApplicationStats(TEST_USER_ID)`

**Step 2: Update jobs.test.ts**

- Same pattern
- `dismissJob("job-1")` -> `dismissJob(TEST_USER_ID, "job-1")`
- `getDismissedJobIds()` -> `getDismissedJobIds(TEST_USER_ID)`

**Step 3: Update scores.test.ts**

- Same pattern
- `getScoreMap(jobIds)` -> `getScoreMap(TEST_USER_ID, jobIds)`
- `getScoresForJobs(jobIds)` -> `getScoresForJobs(TEST_USER_ID, jobIds)`
- `getScoreForJob(jobId, resumeId)` -> `getScoreForJob(TEST_USER_ID, jobId, resumeId)`

**Step 4: Update resumes.test.ts**

- Same pattern
- `getPrimaryResume()` -> `getPrimaryResume(TEST_USER_ID)`
- `getResumeById(id)` -> `getResumeById(TEST_USER_ID, id)`
- `getResumes()` -> `getResumes(TEST_USER_ID)`
- `createResume(data)` -> `createResume(TEST_USER_ID, data)`

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All 139+ tests pass

**Step 6: Commit**

```bash
git add src/lib/supabase/queries/__tests__/
git commit -m "feat(phase6): update unit tests for parameterized userId"
```

---

## Task 9: AI API route - analyze-cv

**Files:**
- Create: `src/app/api/ai/analyze-cv/route.ts`

**Step 1: Create the route**

Create `src/app/api/ai/analyze-cv/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getResumeById, updateResume } from "@/lib/supabase/queries";
import { parseCvText } from "@/lib/services/cv-parser";
import type { Json } from "@/types/database";

const AnalyzeCvBody = z.union([
  z.object({ resumeId: z.string().uuid("resumeId must be a valid UUID") }),
  z.object({ rawText: z.string().min(50, "CV text must be at least 50 characters") }),
]);

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const body = AnalyzeCvBody.parse(raw);

    let rawText: string;
    let resumeId: string | null = null;

    if ("resumeId" in body) {
      resumeId = body.resumeId;
      const resume = await getResumeById(user.id, body.resumeId);
      if (!resume) {
        return NextResponse.json({ error: "Resume not found" }, { status: 404 });
      }
      if (!resume.raw_text) {
        return NextResponse.json(
          { error: "Resume has no raw text. Upload a .txt file or re-parse." },
          { status: 400 }
        );
      }
      rawText = resume.raw_text;
    } else {
      rawText = body.rawText;
    }

    const { parsed, tokensUsed } = await parseCvText(rawText);

    // Save parsed data back to resume row if we have a resumeId
    if (resumeId) {
      await updateResume(resumeId, {
        parsed_data: parsed as unknown as Json,
      });
    }

    return NextResponse.json({ parsed, tokensUsed });
  } catch (error: unknown) {
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

    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[API] POST /api/ai/analyze-cv error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/app/api/ai/analyze-cv/route.ts
git commit -m "feat(phase6): POST /api/ai/analyze-cv route"
```

---

## Task 10: AI API route - match-score

**Files:**
- Create: `src/app/api/ai/match-score/route.ts`

**Step 1: Create the route**

Create `src/app/api/ai/match-score/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getJobById, getResumeById, upsertScore } from "@/lib/supabase/queries";
import { scoreMatch } from "@/lib/services/match-scorer";

const MatchScoreBody = z.object({
  jobId: z.string().uuid("jobId must be a valid UUID"),
  resumeId: z.string().uuid("resumeId must be a valid UUID"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const body = MatchScoreBody.parse(raw);

    const [job, resume] = await Promise.all([
      getJobById(body.jobId),
      getResumeById(user.id, body.resumeId),
    ]);

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    if (!resume.parsed_data || typeof resume.parsed_data !== "object") {
      return NextResponse.json(
        { error: "Resume not yet analyzed. Call /api/ai/analyze-cv first." },
        { status: 400 }
      );
    }
    if (!job.description) {
      return NextResponse.json(
        { error: "Job has no description to match against" },
        { status: 400 }
      );
    }

    const parsed = resume.parsed_data as Record<string, unknown>;
    const skills = (parsed.skills as {
      technical: string[];
      soft: string[];
      languages: string[];
    }) ?? { technical: [], soft: [], languages: [] };

    const cvData = {
      skills,
      experience:
        (parsed.experience as {
          title: string;
          company: string;
          description: string;
        }[]) ?? [],
      summary: (parsed.summary as string) ?? "",
    };

    const { score, tokensUsed } = await scoreMatch(cvData, job.description);

    const savedScore = await upsertScore({
      user_id: user.id,
      job_listing_id: body.jobId,
      resume_id: body.resumeId,
      overall_score: score.overall_score,
      skill_match_score: score.skill_match_score,
      experience_match_score: score.experience_match_score,
      education_match_score: score.education_match_score,
      explanation: score.explanation,
      matching_skills: score.matching_skills,
      missing_skills: score.missing_skills,
      strengths: score.strengths,
      concerns: score.concerns,
    });

    return NextResponse.json({ score: savedScore, tokensUsed });
  } catch (error: unknown) {
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

    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[API] POST /api/ai/match-score error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/app/api/ai/match-score/route.ts
git commit -m "feat(phase6): POST /api/ai/match-score route"
```

---

## Task 11: AI API route - cover-letter

**Files:**
- Create: `src/app/api/ai/cover-letter/route.ts`

**Step 1: Create the route**

Create `src/app/api/ai/cover-letter/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/supabase/get-user";
import { getJobById, getResumeById } from "@/lib/supabase/queries";
import {
  generateCoverLetter,
  type GenerateOptions,
} from "@/lib/services/cover-letter-generator";
import { getSupabase } from "@/lib/supabase/client";

const CoverLetterBody = z.object({
  jobId: z.string().uuid("jobId must be a valid UUID"),
  resumeId: z.string().uuid("resumeId must be a valid UUID"),
  language: z.enum(["fr", "en"]).default("fr"),
  tone: z
    .enum(["professional", "enthusiastic", "creative", "formal"])
    .default("professional"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const body = CoverLetterBody.parse(raw);

    const [job, resume] = await Promise.all([
      getJobById(body.jobId),
      getResumeById(user.id, body.resumeId),
    ]);

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    if (!resume.parsed_data || typeof resume.parsed_data !== "object") {
      return NextResponse.json(
        { error: "Resume not yet analyzed. Call /api/ai/analyze-cv first." },
        { status: 400 }
      );
    }
    if (!job.description) {
      return NextResponse.json(
        { error: "Job has no description" },
        { status: 400 }
      );
    }

    const parsed = resume.parsed_data as Record<string, unknown>;
    const skills = (parsed.skills as {
      technical: string[];
      soft: string[];
      languages: string[];
    }) ?? { technical: [], soft: [], languages: [] };
    const experience =
      (parsed.experience as {
        title: string;
        company: string;
        description: string;
      }[]) ?? [];

    const options: GenerateOptions = {
      cvSummary: (parsed.summary as string) ?? "",
      cvSkills: [...skills.technical, ...skills.soft, ...skills.languages],
      cvExperience: experience
        .map((e) => `${e.title} at ${e.company}: ${e.description}`)
        .join("\n"),
      jobTitle: job.title,
      jobDescription: job.description,
      companyName: job.company_name ?? "Unknown Company",
      language: body.language,
      tone: body.tone,
    };

    const result = await generateCoverLetter(options);

    // Save to cover_letters table
    let savedId: string | null = null;
    try {
      const supabase = getSupabase();
      const { data: saved } = await supabase
        .from("cover_letters")
        .insert({
          user_id: user.id,
          job_listing_id: body.jobId,
          resume_id: body.resumeId,
          content: result.letter.full_text,
          language: body.language,
          tone: body.tone,
        })
        .select("id")
        .single();

      savedId = saved?.id ?? null;
    } catch (dbError) {
      console.error("[API] Failed to save cover letter:", dbError);
    }

    return NextResponse.json({
      letter: result.letter,
      tokensUsed: result.tokensUsed,
      integrityWarnings: result.integrityWarnings,
      savedId,
    });
  } catch (error: unknown) {
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

    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[API] POST /api/ai/cover-letter error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/app/api/ai/cover-letter/route.ts
git commit -m "feat(phase6): POST /api/ai/cover-letter route"
```

---

## Task 12: Final build + full test run

**Step 1: Build**

Run: `npx next build`
Expected: Compiles successfully, 20+ routes, 0 TypeScript errors

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (139+ existing + any new)

**Step 3: Verify USER_ID usage is limited**

Search for `USER_ID` imports - should only appear in:
- `src/lib/supabase/constants.ts` (definition)
- `src/lib/supabase/seed.ts` (dev seed)
- `src/__integration__/supabase-queries.integration.test.ts` (integration tests)
- `docs/` (documentation)

No production code (queries, routes, pages) should import USER_ID.

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "feat(phase6): Phase 6 complete - Supabase Auth + AI API routes"
```

---

## Verification Checklist

1. `npm run build` - 0 TypeScript errors
2. `npx vitest run` - all tests pass
3. Manual test: navigate to `/fr/login` -> should show login form (no demo creds)
4. Manual test: click "signup" link -> should show signup form
5. Manual test: `USER_ID` grep shows only seed.ts, integration tests, constants.ts
6. API routes respond 401 when no auth session:
   - `curl -X POST http://localhost:3000/api/ai/analyze-cv` -> 401
   - `curl -X POST http://localhost:3000/api/profile` -> 500 (requireUser throws)
7. New routes exist: `/api/ai/analyze-cv`, `/api/ai/match-score`, `/api/ai/cover-letter`

## Pre-requisites (Supabase Dashboard - manual)

Before testing auth end-to-end:
1. Enable Email/Password auth provider in Supabase Dashboard > Authentication > Providers
2. For dev: consider disabling email confirmation (Settings > Auth > Enable email confirmations = OFF)
3. Create initial user with UUID `126d2d02-c032-49b0-a2c8-8a7034b6512f` via Dashboard or SQL to preserve existing data
4. Ensure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is in `.env.local`
