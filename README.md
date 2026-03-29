# JobPilot

**Assistant personnel de recherche d'emploi** -- Agregation d'offres depuis JSearch (RapidAPI) + Adzuna, scoring AI vs CV, generation de lettres de motivation, et suivi de candidatures via pipeline Kanban.

Application personnelle (single-user), bilingue FR/EN.

---

## Apercu

JobPilot automatise la recherche d'emploi en :

1. **Agregant** les offres de JSearch et Adzuna en un seul flux deduplique
2. **Scorant** chaque offre contre votre CV via OpenAI (GPT-4o-mini)
3. **Generant** des lettres de motivation personnalisees avec detection anti-hallucination
4. **Trackant** les candidatures dans un pipeline Kanban (Saved -> Applying -> Applied -> Interview -> Offer)
5. **Notifiant** par email (React Email + Resend) quand un match depasse le seuil choisi (defaut: 60/100)
6. **Schedulant** une recherche automatique (manuelle, quotidienne, ou hebdomadaire)

---

## Stack Technique

| Categorie | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (OKLch colors) + shadcn/ui |
| Base de donnees | Supabase (PostgreSQL + Storage) |
| Auth | Supabase Auth (email/password) via `@supabase/ssr` |
| AI | OpenAI GPT-4o-mini (structured outputs) |
| APIs emploi | JSearch (RapidAPI) + Adzuna API v1 |
| i18n | next-intl (FR/EN) |
| Email | React Email + Resend |
| Tests | Vitest (unit/integration) + Playwright (E2E) |
| Validation | Zod |
| Deploiement | Vercel |

---

## Decisions Architecturales

| Decision | Choix | Justification |
|----------|-------|---------------|
| Auth | Supabase Auth (email/password) via `@supabase/ssr` | Auth reelle avec session JWT, remplace demo login |
| Dual Client | Auth client (ANON_KEY) + Data client (SERVICE_ROLE_KEY) | Separation auth/data, pas de migration RLS necessaire |
| Profile auto | DB trigger sur `auth.users` INSERT | Creation profil automatique au signup, pas de race condition |
| Layout | Route groups `(app)` / `(auth)` | Separation sidebar (pages auth) vs centree (login/signup) |
| CV Input | Upload PDF (parsing AI) | Texte brut elimine en faveur de PDF pour meilleure UX |
| Notifications | Manuel / Quotidien / Hebdomadaire | Choix utilisateur, pas d'optimisation prematuree |
| Seuil alertes | Configurable (defaut 60/100) | L'utilisateur choisit son seuil minimum d'alerte |
| Email template | React Email (responsive) | Templates beaux et responsifs pour Phase 8 |
| Anti-hallucination | Cross-ref lettre vs CV | Detecte les skills inventes dans les lettres |
| Dedup | Hash SHA-256 (titre+company+location) | Simple mais suffisant pour MVP |
| Actions offres | "Voir offre" + "Postuler" separes | 2 actions distinctes pour meilleure UX |
| Offres dismisses | Corbeille dans page Jobs | Tab dans la page existante, pas de page separee |
| API migration | JSearch remplace Jooble | Jooble retournait donnees incoherentes, JSearch plus fiable via RapidAPI |

---

## Phases d'Implementation

### Phase 1: Foundation -- COMPLETE
- [x] Project scaffold (Next.js 16, Tailwind v4, TypeScript)
- [x] Claude Code configs (hooks, MCP servers, code style rules)
- [x] Implementation plan redige
- [x] Installation des dependances (Supabase, OpenAI, Zod, next-intl, Resend, Vitest)
- [x] shadcn/ui setup (13 composants + sonner)
- [x] Schema DB Supabase (8 tables + triggers)
- [x] Supabase client + auth simple (password)
- [x] Auth middleware + i18n (FR/EN)

### Phase 2: Data Layer -- COMPLETE
- [x] Zod schemas (JSearch, Adzuna, UnifiedJob) - adapted for Zod v4
- [x] Service de deduplication (hash + data richness scoring)
- [x] Client API JSearch (via RapidAPI, remplace Jooble)
- [x] Client API Adzuna (with Zod validation)
- [x] Job Aggregator Service (combine + deduplicate)

### Phase 3: AI Services -- COMPLETE
- [x] OpenAI client (structured outputs via Zod, SDK v6)
- [x] AI schemas (MatchScore, ParsedResume, CoverLetter, CvOptimization)
- [x] Match Scorer (buildMatchPrompt + scoreMatch)
- [x] CV Parser (parseCvText)
- [x] Cover Letter Generator (avec anti-hallucination checkIntegrity)

### Phase 4: UI Pages -- COMPLETE
- [x] Login page + signup page (Supabase Auth email/password)
- [x] Route groups: `(app)` avec sidebar, `(auth)` sans sidebar
- [x] App layout (sidebar responsive + header + theme toggle)
- [x] Dashboard (stats cards + top jobs + recent applications)
- [x] Job listings (filtres source/remote/score + search + cards)
- [x] Applications pipeline (Kanban board + List view, 8 statuts)
- [x] Settings (5 onglets: Profile, Search, CV, Appearance, Notifications)
- [x] Notifications settings (frequence manuelle/quotidienne/hebdomadaire + email alerts placeholder)
- [x] Dark mode / Light mode / System
- [x] i18n complet FR/EN (tous les textes)

### Phase 5: Supabase Integration -- COMPLETE
- [x] Connexion Supabase reelle (remplacer mock data)
- [x] Query layers (4 modules: applications, jobs, resumes, scores)
- [x] CRUD offres d'emploi (save, dismiss, restore)
- [x] Pipeline candidatures (create, update status, delete)
- [x] Profil utilisateur (save/load preferences)
- [x] Upload CV (Supabase Storage + parsing AI)
- [x] Dev seed endpoint (`/api/dev/seed`)
- [x] 139 tests unitaires (14 fichiers)

### Phase 6: Auth + AI API Routes -- COMPLETE
- [x] Supabase Auth email/password (`@supabase/ssr`)
- [x] Auth utilities (server client, middleware client, browser client, getUser/requireUser)
- [x] Middleware rewrite (session Supabase + merge cookies intl)
- [x] Login/Signup/Logout/Callback routes
- [x] DB trigger profile auto-creation on signup
- [x] Dynamic userId migration (14 query functions, 5 API routes, 4 pages, 4 test files)
- [x] POST /api/ai/analyze-cv (parse CV via OpenAI)
- [x] POST /api/ai/match-score (score correspondance CV/offre)
- [x] POST /api/ai/cover-letter (generation lettre de motivation)
- [x] /api/jobs/search (JSearch + Adzuna aggregation)
- [x] /api/applications (CRUD)

### Phase 7: Interactivite Avancee -- COMPLETE
- [x] Indicateur visuel "offre vue" (seen_jobs tracking)
- [x] Corbeille offres dismisses (restauration, tab dans page Jobs)
- [x] Recherche par mots-cles libres (search debounce)
- [x] Toast notifications

### Phase 8: Notifications + Email -- COMPLETE
- [x] Templates email responsifs (React Email, rich layouts)
- [x] Integration Resend (envoi automatique)
- [x] Cron recherche automatique (quotidien)
- [x] Alertes nouveaux matchs (seuil configurable, defaut 60)
- [x] Rappels suivi candidatures (stale applications 14j)
- [x] Resume hebdomadaire

### Phase 9: Deploiement + Polish -- COMPLETE
- [x] Vercel deployment (production)
- [x] Variables d'environnement production
- [x] Tests E2E (Playwright: auth, jobs, applications, settings)
- [x] Export CSV + JSON avec filtres (jours, minScore, profil)

### Phase 10: Cowork API + Agent Automation -- COMPLETE
- [x] Endpoints Cowork (`/api/cowork/*`) pour automation Claude
- [x] Agent columns (agent_status, ats_type, agent_notes) sur applications
- [x] getReadyApplicationsForAgent + updateAgentStatus
- [x] CRON_SECRET auth sur export GET

### Phase 11: Fresh Jobs Pipeline + Robustness -- COMPLETE
- [x] Suppression inbox_limit blocking (cron fetch toujours)
- [x] Auto-expire lifecycle (3j processed, 7j unseen, 30j absolute)
- [x] Dashboard en mode inbox (jobs frais uniquement)
- [x] unseenJobCount dans cowork dashboard-summary
- [x] Auto-mark scored jobs as seen (cron + cowork)
- [x] RPC Postgres anti-joins (remplace NOT IN string concat)
- [x] 4 indexes de performance (compound indexes)
- [x] Auth cron unifiee (verifyCronSecret partout)
- [x] Codes d'erreur specifiques pour agent debugging
- [x] Cron timing optimise (expire 2AM -> fetch 4AM -> notif 4:30AM UTC)

---

## Schema Base de Donnees

10 migrations PostgreSQL via Supabase :

| Table | Description |
|-------|-------------|
| `profiles` | User profile + search preferences (rotation profiles, keywords, locations) |
| `resumes` | CV(s) avec texte brut et donnees parsees (is_primary flag) |
| `job_listings` | Offres agregees (dedup_hash unique, profile_label, is_active lifecycle) |
| `seen_jobs` | Tracking des offres vues/dismisses (auto-expire 3j) |
| `match_scores` | Scores AI par offre/CV (overall, skill, experience, education) |
| `applications` | Pipeline Kanban (8 statuts + agent_status, ats_type, agent_notes) |
| `cover_letters` | Lettres generees avec versioning + integrity warnings |
| `career_chat_sessions` | Sessions de chat IA carriere |
| `career_chat_messages` | Messages de chat IA carriere |

### RPC Functions (migration 009)
- `expire_processed_jobs(days)` -- Expire jobs vus/dismissed, protege les candidatures actives
- `expire_unseen_jobs(days)` -- Expire jobs jamais vus
- `expire_absolute_jobs(days)` -- Expiration absolue
- `count_unseen_jobs(user_id)` -- Compteur jobs frais
- `cleanup_unscored_jobs()` -- Desactive jobs jamais scores

---

## API Routes

### User-facing
| Route | Methode | Description |
|-------|---------|-------------|
| `/api/jobs/search` | POST | Recherche agregee JSearch + Adzuna |
| `/api/jobs/dismiss` | POST | Dismiss/restore une offre |
| `/api/jobs/seen` | POST | Marquer une offre comme vue |
| `/api/jobs/export` | GET | Export CSV/JSON avec filtres |
| `/api/jobs/manual-search` | POST | Recherche manuelle (3/24h) |
| `/api/applications` | POST | Creer une candidature |
| `/api/applications/[id]` | PATCH/DELETE | Modifier/supprimer une candidature |
| `/api/profile` | PATCH | Modifier le profil utilisateur |
| `/api/resumes/upload` | POST | Upload CV (Supabase Storage) |
| `/api/resumes/[id]` | DELETE | Supprimer un CV |
| `/api/ai/analyze-cv` | POST | Parser un CV via OpenAI |
| `/api/ai/match-score` | POST | Scorer correspondance CV/offre |
| `/api/ai/score-jobs` | POST | Scorer plusieurs offres en batch |
| `/api/ai/cover-letter` | POST/PATCH | Generer/modifier lettre de motivation |
| `/api/ai/match-score-detail` | GET | Detail score pour modale |
| `/api/health` | GET | Keepalive Supabase |

### Cron (auth: Bearer CRON_SECRET)
| Route | Schedule | Description |
|-------|----------|-------------|
| `/api/cron/expire-jobs` | 2AM UTC | Expire jobs (3j/7j/30j lifecycle via RPC) |
| `/api/cron/fetch-jobs` | 4AM UTC | Fetch + score + auto-mark seen |
| `/api/cron/notifications` | 4:30AM UTC | Resume hebdo + rappels candidatures stale |

### Cowork API (auth: Bearer CRON_SECRET)
| Route | Methode | Description |
|-------|---------|-------------|
| `/api/cowork/dashboard-summary` | GET | Stats + unseenJobCount + preferences |
| `/api/cowork/fetch-and-score` | POST | Fetch + upsert + score top 5 + auto-mark seen |
| `/api/cowork/browser-apply` | POST | Creer candidature (retourne 201) |
| `/api/cowork/notify` | POST | Envoyer emails (new_matches / stale_reminder) |
| `/api/cowork/stale-applications` | GET | Candidatures sans update depuis N jours |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Compte Supabase (free tier)
- Cle API OpenAI
- Cle API JSearch (via RapidAPI)
- Cle API Adzuna (App ID + App Key)
- (Optionnel) Cle API Resend pour les notifications email

### Installation

```bash
git clone https://github.com/aziztraorebf-ctrl/jobpilot.git
cd jobpilot
npm install
```

### Configuration

Copier le fichier d'exemple et remplir les valeurs :

```bash
cp .env.example .env.local
```

Variables requises :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# JSearch (RapidAPI)
JSEARCH_API_KEY=

# Adzuna
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=ca

# Cron Security
CRON_SECRET=

# Notifications (optionnel)
RESEND_API_KEY=
NOTIFY_EMAIL=
```

### Supabase Auth Setup

1. Activer le provider Email/Password dans Authentication > Providers
2. (Optionnel dev) Desactiver la confirmation email
3. S'assurer que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont dans `.env.local`

### Development

```bash
npm run dev        # Serveur de dev (http://localhost:3000)
npm run build      # Build production
npm run test       # Tests (watch mode)
npm run test:run   # Tests (single run)
```

---

## Cout Estime (mensuel, usage personnel)

| Service | Cout |
|---------|------|
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier) |
| OpenAI (~200 scorings + 30 lettres) | ~$0.30 |
| JSearch (RapidAPI free tier) | $0 (500 req/mois) |
| Resend (emails) | $0 (free: 100/jour) |
| **Total** | **~$0.30/mois** |

---

## Tests

14 fichiers de tests, 139 tests au total :

| Type | Fichiers | Tests |
|------|----------|-------|
| Unit - JSearch client | `src/lib/api/__tests__/jsearch.test.ts` | 7 |
| Unit - Jooble client | `src/lib/api/__tests__/jooble.test.ts` | 3 |
| Unit - Adzuna client | `src/lib/api/__tests__/adzuna.test.ts` | 8 |
| Unit - Dedup service | `src/lib/services/__tests__/deduplicator.test.ts` | 4 |
| Unit - Job aggregator | `src/lib/services/__tests__/job-aggregator.test.ts` | 2 |
| Unit - Match scorer | `src/lib/services/__tests__/match-scorer.test.ts` | 2 |
| Unit - AI schemas | `src/lib/schemas/__tests__/ai-responses.test.ts` | 4 |
| Unit - Job schemas | `src/lib/schemas/__tests__/job.test.ts` | 8 |
| Unit - Applications queries | `src/lib/supabase/queries/__tests__/applications.test.ts` | 32 |
| Unit - Jobs queries | `src/lib/supabase/queries/__tests__/jobs.test.ts` | 27 |
| Unit - Resumes queries | `src/lib/supabase/queries/__tests__/resumes.test.ts` | 17 |
| Unit - Scores queries | `src/lib/supabase/queries/__tests__/scores.test.ts` | 16 |
| Unit - Profiles queries | `src/lib/supabase/queries/__tests__/profiles.test.ts` | 7 |
| Smoke tests | `src/test/smoke.test.ts` | 2 |

---

## Limitations Connues

| Limitation | Solution future |
|------------|----------------|
| Dedup hash-based naif | Fuzzy matching ou dedup semantique via OpenAI |
| JSearch free tier (500 req/mois) | Plan payant si besoin, cache agressif |
| Adzuna free tier (2500/mois) | Cache 24h, privilegier JSearch |
| Anti-hallucination keyword-based | Verification semantique via OpenAI |
| Pas de RLS (Row Level Security) | Migration RLS prevue si multi-user |
| Upload PDF 500 sur Vercel | unpdf installe, workaround .txt |
| Vercel hobby timeout 60s | Scoring peut timeout si trop de jobs |

---

## Documentation

- [Plan MVP](docs/plans/2026-01-31-jobpilot-mvp.md) - Architecture initiale, phases 1-6
- [Plan Fresh Jobs Pipeline](docs/plans/2026-03-28-fresh-jobs-pipeline.md) - Fix pipeline jobs stale
- [Plan Robustness Fixes](docs/plans/2026-03-28-robustness-fixes.md) - RPC, indexes, error codes
- [Backlog](docs/BACKLOG.md) - Bugs et features a faire
- [Compact Master](docs/compact_master.md) - Reference permanente du projet
- [Compact Current](docs/compact_current.md) - Etat actuel (mis a jour chaque session)
- [Regles de code style](.claude/CODE_STYLE_RULES.md) - Zero emojis dans le code

---

## License

Projet personnel. Non destine a la distribution.
