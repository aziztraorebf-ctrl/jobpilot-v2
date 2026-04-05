# JobPilot - Compact Master

> Reference permanente du projet. Decisions architecturales, stack, conventions.
> Derniere mise a jour : 2026-04-04

---

## Vision & Objectif

Application personnelle d'assistance a la recherche d'emploi 100% automatisee. Agregation d'offres (JSearch, Adzuna, Firecrawl), scoring IA vs CV, candidatures semi-automatiques, pipeline Kanban. Usage mono-utilisateur (Aziz). L'agent Cowork orchestre le tout via les endpoints API.

---

## Stack Technique

| Couche | Tech |
|--------|------|
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS v4, shadcn/ui |
| Backend | Next.js API Routes (App Router) |
| DB | Supabase PostgreSQL (pas de Supabase Auth) |
| Storage | Supabase Storage (CVs) |
| IA | OpenAI GPT-4o-mini (scoring, parsing CV, lettres) |
| Jobs APIs | JSearch, Adzuna |
| Web Scraping | Firecrawl (`@mendable/firecrawl-js` v4.18.1) — scrape, search, extract, interact, agent |
| Email (notifications) | Resend + React Email |
| Email (candidatures) | AgentMail (jobpilot-aziz@agentmail.to) |
| i18n | next-intl (FR/EN) |
| Auth | Mot de passe unique en env var + middleware |
| Tests | Vitest (unit/integration), Playwright (E2E) |
| Deploy | Vercel (hobby tier, 60s timeout), Supabase (DB) |
| Validation | Zod v4 |

---

## Architecture DB (tables principales)

- **profiles** : utilisateur unique, search_preferences (JSONB avec rotation_profiles), compteurs OpenAI
- **resumes** : CVs uploades (3 actifs : Securite PDF, Coordination TXT, Polyvalent TXT), texte brut + parsed_data
- **job_listings** : offres agregees (source: jooble/adzuna/jsearch/firecrawl/manual, dedup_hash unique)
- **seen_jobs** : tracking vu/dismissed par user+job
- **match_scores** : scores IA (overall, skill, experience, education) + matching/missing skills
- **applications** : pipeline Kanban + colonnes agent (agent_status, ats_type, agent_notes)
- **career_chat_sessions / career_chat_messages** : chat IA carriere (tables existent, feature partielle)

### Migrations appliquees (11)
001_initial_schema -> 002_jsearch_source -> 003_auth_profile_trigger -> 004_dedup_hash_unique -> 005_career_chat_tables -> 006_integrity_warnings -> 007_profile_label -> 008_agent_columns -> 009_add_rpc_functions -> 010_add_performance_indexes -> 011_add_firecrawl_source

---

## Decisions Architecturales Cles

| Decision | Choix | Raison |
|----------|-------|--------|
| Auth | Password env var + middleware | Mono-utilisateur, pas besoin de Supabase Auth |
| CV input | Upload fichier (PDF/TXT) + parsing IA | PDF via Firecrawl parser v2 Rust (signed URL) |
| Scoring | Auto-scoring dans le cron + auto-mark seen | Jobs scores sortent de l'inbox, expirent apres 3j |
| Dedup | Hash normalise (title+company+location) SHA-256 | Normalisation corp suffixes, tech terms, provinces CA |
| Export | CSV + JSON avec filtres (jours, minScore, profil) | Utilisable par agents externes |
| Cowork API | Endpoints dedies /api/cowork/* | Pour automation Claude Cowork |
| Scout | Endpoint dedie /api/cowork/scout (3 modes) | Decouverte proactive hors APIs (Jobillico, pages carrieres) |
| browser-apply | 3 phases (recon, decision, execution) | Firecrawl scrape + interact, escalade si auth requise |
| Agent columns | agent_status, ats_type, agent_notes | Tracking candidatures par agent IA |
| AgentMail | jobpilot-aziz@agentmail.to | Email dedie pour candidatures, separe de l'inbox perso |
| Mode operatoire | 100% automatise | Pipeline continu : expire → fetch → score → notify |
| Expiry lifecycle | 3j processed, 7j unseen, 30j absolute (RPC) | Jobs avec candidature active jamais expires |
| Query scaling | RPC Postgres anti-joins (NOT EXISTS) | Remplace NOT IN string concat |
| Error codes API | KNOWN_ERROR_CODES dans apiError | L'agent distingue les types d'erreur |
| Cron timing | expire 2AM → fetch 4AM → notifications 4:30AM UTC | Nettoyer avant remplir |
| Rotation CV | 3 profils (Securite, Coordination, Large), 1 jour/profil | Chaque profil a son propre CV et ses mots-cles |

---

## Structure du Projet

```
src/
  app/
    [locale]/          # Pages i18n (FR/EN)
    api/
      ai/              # match-score, cover-letter, analyze-cv, career-chat
      applications/    # CRUD candidatures
      auth/            # Login/logout
      cowork/          # API automation agent (7 endpoints)
        browser-apply/ # Candidature auto 3 phases
        dashboard-summary/
        fetch-and-score/
        next-actions/  # Decision engine
        notify/
        scout/         # Decouverte proactive (3 modes)
        stale-applications/
      cron/            # fetch-jobs, notifications
      dev/             # Outils dev
      health/          # Keepalive Supabase
      jobs/            # CRUD jobs, export
      profile/         # Profil utilisateur
      resumes/         # Upload/delete CV
  lib/
    api/
      firecrawl.ts     # Client wrapper Firecrawl SDK
      firecrawl-jobs.ts # Fetcher offres via search+extract
      jsearch.ts       # Adapter JSearch
      adzuna.ts        # Adapter Adzuna
    services/
      scout.ts         # Service decouverte (3 modes)
      browser-apply.ts # Service candidature (3 phases)
      stale-checker.ts # Verification offres fermees
      auto-scorer.ts   # Scoring IA
      job-aggregator.ts # Agregation 3 sources
      deduplicator.ts  # Dedup avec normalisation avancee
      cv-parser.ts     # Parsing CV via OpenAI
    supabase/          # Client, queries
    schemas/           # Zod schemas (job, score, etc.)
docs/
  agent-orchestration.md    # Guide technique pour l'agent
  jobpilot-agent-briefing.md # Briefing complet pour Cowork
  compact_current.md        # Etat actuel (cette session)
  compact_master.md         # Reference permanente (ce fichier)
  plans/                    # Plans d'implementation
supabase/
  migrations/               # 11 migrations SQL
```

---

## Phases Completees

1. **Scaffold** : Next.js + shadcn/ui + Supabase schema
2. **API Jobs** : Integration Jooble, Adzuna, JSearch + dedup
3. **Supabase Integration** : Queries, client setup
4. **UI Design** : Pages jobs, applications, settings, dashboard
5. **Supabase Full** : CRUD complet, seen/dismissed
6. **Auth + AI Routes** : Login, scoring IA, parsing CV
7. **Audit/Refactor** : Code simplification
8. **Notifications Email** : Cron fetch + email alerts via Resend
9. **E2E Tests** : Playwright infrastructure + tests
10. **Export** : CSV + JSON export avec filtres
11. **Cowork API** : Endpoints pour Claude Cowork automation
12. **Agent Columns** : agent_status, ats_type, agent_notes
13. **Fresh Jobs Pipeline** : Expiry 3-tier, inbox-only, auto-mark seen
14. **Robustness** : RPC anti-joins, indexes, error codes, cron timing
15. **Score Refresh** : Auto re-score sur changement CV
16. **Firecrawl Integration** : PDF fix, 3e source, dedup, browser-apply, Scout, AgentMail

---

## Conventions

- **Sub-agents ne commitent pas** — seul l'orchestrateur fait les commits
- **Templates email** : beaux, responsifs, detailles mais pas complexes
- **Verifier visuellement avec Playwright AVANT de corriger des problemes UI**
- **i18n obligatoire** : toutes les strings UI dans messages/fr.json et messages/en.json
- **Zod validation** : tous les inputs API
- **Mobile-first** : tout design responsive, tester 375px
- **Firecrawl JSON Schemas** : utiliser Record<string, unknown> (pas Zod natif — incompatibilite v3/v4)
- **Scout targets** : jamais Indeed/Glassdoor/LinkedIn (couverts par JSearch)
- **browser-apply** : escalader LinkedIn/Indeed/Workday a needs_review
