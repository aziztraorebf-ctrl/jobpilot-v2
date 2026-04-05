# JobPilot v2

**Assistant personnel de recherche d'emploi 100% automatise** -- Agregation d'offres depuis JSearch, Adzuna et Firecrawl, scoring IA vs CV, candidatures semi-automatiques via browser automation, et decouverte proactive d'offres via web scraping.

Application personnelle (single-user), bilingue FR/EN.

---

## Apercu

JobPilot automatise le cycle complet de recherche d'emploi :

1. **Aggrege** les offres de JSearch, Adzuna et Firecrawl en un flux deduplique avec normalisation avancee
2. **Score** chaque offre contre votre CV actif via OpenAI (GPT-4o-mini), avec rotation automatique de 3 profils de recherche
3. **Decouvre** des offres invisibles aux APIs en scrapant directement les pages carrieres d'employeurs (Jobillico, Jobboom, STM, Ville de Montreal, etc.)
4. **Postule** semi-automatiquement via Firecrawl browser automation (formulaires simples : Greenhouse, Lever, sites employeurs)
5. **Verifie** si les candidatures stagnantes sont encore actives en scrapant les URLs d'offres
6. **Notifie** par email quand un match depasse le seuil choisi
7. **Orchestre** le tout via des endpoints API dedies, pilotes par un agent IA (Claude Cowork)

---

## Stack Technique

| Categorie | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Base de donnees | Supabase PostgreSQL + Storage |
| Auth | Mot de passe unique en env var + middleware |
| IA | OpenAI GPT-4o-mini (structured outputs) |
| APIs emploi | JSearch (RapidAPI) + Adzuna API v1 |
| Web Scraping | Firecrawl (`@mendable/firecrawl-js` v4.18.1) |
| Email (notifications) | Resend + React Email |
| Email (candidatures) | AgentMail (jobpilot-aziz@agentmail.to) |
| i18n | next-intl (FR/EN) |
| Tests | Vitest (274 tests) + Playwright (E2E) |
| Validation | Zod v4 |
| Deploiement | Vercel (hobby tier) |

---

## Architecture

### Pipeline quotidien automatise

```
2:00 AM UTC  -- Expiration des offres perimees (3j/7j/30j lifecycle via RPC)
4:00 AM UTC  -- Fetch (JSearch + Adzuna + Firecrawl) -> Dedup -> Upsert -> Score -> Mark seen
4:30 AM UTC  -- Notifications email (digest des meilleurs matchs)
On-demand    -- Scout (decouverte proactive) + browser-apply (candidatures)
```

### Rotation de profils

Le systeme alterne automatiquement entre 3 profils de recherche (1 jour/profil) :

| Profil | Mots-cles | CV utilise |
|--------|-----------|------------|
| Securite | Security Supervisor, Security Manager... | CV PDF (experience securite) |
| Coordination | Chef de projet, Coordinateur... | CV TXT (orienté institutionnel) |
| Large | commis, reception, entrepot, service client... | CV Polyvalent (competences transferables) |

### Deduplication avancee

Hash SHA-256 normalise avec :
- Suffixes corp : "TechCorp Inc." = "TechCorp"
- Variantes tech : "React.js Developer" = "React Developer"
- Provinces canadiennes : "Toronto, Ontario, Canada" = "Toronto, ON"

---

## API Routes

### Cowork API (auth: Bearer CRON_SECRET)

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/cowork/next-actions` | GET | Decide quoi faire ensuite (fetch, apply, notify, idle) |
| `/api/cowork/fetch-and-score` | POST | Fetch + upsert + score (JSearch + Adzuna + Firecrawl) |
| `/api/cowork/scout` | POST | Decouverte proactive (3 modes: targets, search, agent) |
| `/api/cowork/browser-apply` | POST | Candidature 3 phases (recon, decision, execution) |
| `/api/cowork/stale-applications` | GET | Candidatures stagnantes + verification URL (?check_urls=true) |
| `/api/cowork/dashboard-summary` | GET | Stats pipeline + unseenJobCount |
| `/api/cowork/notify` | POST | Envoyer emails (new_matches / stale_reminder) |

### User-facing API

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/jobs/search` | POST | Recherche agregee |
| `/api/jobs/dismiss` | POST | Dismiss/restore offre |
| `/api/jobs/export` | GET | Export CSV/JSON |
| `/api/ai/analyze-cv` | POST | Parser CV (PDF via Firecrawl, TXT direct) |
| `/api/ai/match-score` | POST | Scorer correspondance CV/offre |
| `/api/ai/cover-letter` | POST | Generer lettre de motivation |
| `/api/ai/match-score-detail` | GET | Detail score pour modale |
| `/api/applications` | POST | Creer candidature |
| `/api/applications/[id]` | PATCH/DELETE | Modifier/supprimer candidature |

### Cron (auth: Bearer CRON_SECRET)

| Route | Schedule | Description |
|-------|----------|-------------|
| `/api/cron/expire-jobs` | 2AM UTC | Expire jobs (3j/7j/30j via RPC) |
| `/api/cron/fetch-jobs` | 4AM UTC | Fetch + score + mark seen + rotate profile |
| `/api/cron/notifications` | 4:30AM UTC | Digest email + rappels stale |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Compte Supabase (free tier)
- Cle API OpenAI
- Cle API JSearch (via RapidAPI)
- Cle API Adzuna (App ID + App Key)
- Cle API Firecrawl (firecrawl.dev)
- (Optionnel) Cle API Resend pour les notifications

### Installation

```bash
git clone https://github.com/aziztraorebf-ctrl/jobpilot-v2.git
cd jobpilot-v2
npm install
```

### Configuration

```bash
cp .env.example .env.local
```

Variables requises :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App Auth
APP_PASSWORD=

# OpenAI
OPENAI_API_KEY=

# JSearch (RapidAPI)
JSEARCH_API_KEY=

# Adzuna
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=ca

# Firecrawl
FIRECRAWL_API_KEY=

# AgentMail (email pour candidatures)
AGENT_EMAIL=jobpilot-aziz@agentmail.to

# Cron Security
CRON_SECRET=

# Notifications (optionnel)
RESEND_API_KEY=
NOTIFY_EMAIL=
```

### Development

```bash
npm run dev        # Serveur de dev (http://localhost:3000)
npm run build      # Build production
npm run test       # Tests (watch mode)
npm run test:run   # Tests (single run)
```

---

## Base de Donnees

11 migrations PostgreSQL via Supabase :

| Table | Description |
|-------|-------------|
| `profiles` | User profile + search_preferences (rotation_profiles, keywords, locations) |
| `resumes` | CVs avec texte brut et donnees parsees (3 actifs en rotation) |
| `job_listings` | Offres agregees (source: jooble/adzuna/jsearch/firecrawl/manual) |
| `seen_jobs` | Tracking offres vues/dismisses |
| `match_scores` | Scores IA par offre/CV (overall, skill, experience, education) |
| `applications` | Pipeline Kanban (8 statuts) + agent columns (agent_status, ats_type, agent_notes) |
| `cover_letters` | Lettres generees avec integrity warnings |
| `career_chat_sessions` | Sessions chat IA carriere |
| `career_chat_messages` | Messages chat IA carriere |

---

## Tests

274 tests au total :

| Type | Tests |
|------|-------|
| Schemas (job, AI, dedup) | 17 |
| API clients (JSearch, Adzuna) | 15 |
| Services (aggregator, scorer, dedup) | 4 |
| Queries (applications, jobs, resumes, scores, profiles) | 99 |
| Cowork (next-actions, browser-apply, scout) | 27 |
| AI routes (analyze-cv, score refresh) | 7 |
| CSV export | 6 |
| Search profile helpers | 11 |
| Stale checker | 5 |
| Other (smoke, keyword suggestions) | 83 |

---

## Cout Estime (mensuel, usage personnel)

| Service | Cout |
|---------|------|
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier) |
| OpenAI (~200 scorings + 30 lettres) | ~$0.30 |
| JSearch (RapidAPI free tier) | $0 (500 req/mois) |
| Adzuna | $0 (2500 req/mois) |
| Firecrawl | $0 (500 credits free tier) |
| AgentMail | $0 (free tier) |
| Resend | $0 (100 emails/jour) |
| **Total** | **~$0.30/mois** |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Agent Orchestration](docs/agent-orchestration.md) | Guide technique pour l'agent Cowork |
| [Agent Briefing](docs/jobpilot-agent-briefing.md) | Briefing complet (16 sections) pour Cowork |
| [Compact Master](docs/compact_master.md) | Reference permanente (architecture, decisions, conventions) |
| [Compact Current](docs/compact_current.md) | Etat actuel du projet |
| [Plan Firecrawl](docs/plans/2026-04-04-firecrawl-integration.md) | Plan d'integration Firecrawl |

---

## License

Projet personnel. Non destine a la distribution.
