# JobPilot - Compact Master

> Reference permanente du projet. Decisions architecturales, stack, conventions.
> Derniere mise a jour : 2026-03-28

---

## Vision & Objectif

Application personnelle d'assistance a la recherche d'emploi. Agregation d'offres (Jooble, Adzuna, JSearch), scoring IA vs CV, generation de lettres de motivation, pipeline de candidatures en Kanban. Usage mono-utilisateur (Aziz).

---

## Stack Technique

| Couche | Tech |
|--------|------|
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS v4, shadcn/ui |
| Backend | Next.js API Routes (App Router) |
| DB | Supabase PostgreSQL (pas de Supabase Auth) |
| Storage | Supabase Storage (CVs) |
| IA | OpenAI GPT-4o-mini (scoring, parsing CV, lettres) |
| Jobs APIs | Jooble, Adzuna, JSearch |
| Email | Resend + React Email |
| i18n | next-intl (FR/EN) |
| Auth | Mot de passe unique en env var + middleware |
| Tests | Vitest (unit/integration), Playwright (E2E) |
| Deploy | Vercel (frontend), Supabase (DB) |
| Validation | Zod |

---

## Architecture DB (tables principales)

- **profiles** : utilisateur unique, preferences de recherche (JSONB), compteurs OpenAI
- **resumes** : CVs uploades, texte brut + parsed_data (JSONB), flag is_primary
- **job_listings** : offres agregees (source, dedup_hash unique, location, salary, remote_type, profile_label)
- **seen_jobs** : tracking vu/dismissed par user+job
- **match_scores** : scores IA (overall, skill, experience, education) + matching/missing skills, strengths, concerns
- **applications** : pipeline Kanban (saved -> applied -> interview -> offer -> rejected), agent_status, ats_type, agent_notes
- **career_chat_sessions / career_chat_messages** : chat IA carriere (tables existent, feature partielle)

### Migrations appliquees (10)
001_initial_schema -> 002_jsearch_source -> 003_auth_profile_trigger -> 004_dedup_hash_unique -> 005_career_chat_tables -> 006_integrity_warnings -> 007_profile_label -> 008_agent_columns -> 009_add_rpc_functions -> 010_add_performance_indexes

---

## Decisions Architecturales Cles

| Decision | Choix | Raison |
|----------|-------|--------|
| Auth | Password env var + middleware | Mono-utilisateur, pas besoin de Supabase Auth |
| CV input | Upload fichier (PDF/TXT) + parsing IA | PDF via unpdf (pdf-parse abandonne car 500 sur Vercel Serverless) |
| Scoring | Auto-scoring dans le cron + auto-mark seen | Jobs scores sortent de l'inbox, expirent apres 3j |
| Dedup | Hash-based (dedup_hash unique) | Simple et suffisant pour le volume |
| Export | CSV + JSON avec filtres (jours, minScore, profil) | Utilisable par agents externes |
| Cowork API | Endpoints dedies /api/cowork/* | Pour automation Claude Cowork |
| Agent columns | agent_status, ats_type, agent_notes sur applications | Pour tracking des candidatures par agent IA |
| Mode operatoire | 100% automatise (plus de mode manuel) | Architecture priorise flux continu de nouvelles offres |
| Expiry lifecycle | 3j processed, 7j unseen, 30j absolute (RPC) | Jobs avec candidature active jamais expires |
| Query scaling | RPC Postgres anti-joins (NOT EXISTS) | Remplace NOT IN string concat qui crash a 10k+ IDs |
| Error codes API | KNOWN_ERROR_CODES map dans apiError | L'agent distingue les types d'erreur et retry intelligemment |
| Cron timing | expire 2AM -> fetch 4AM -> notifications 4:30AM UTC | Nettoyer avant remplir, buffer apres fetch |

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
      cowork/          # API automation agent
      cron/            # fetch-jobs, notifications
      dev/             # Outils dev
      health/          # Keepalive Supabase
      jobs/            # CRUD jobs, export
      profile/         # Profil utilisateur
      resumes/         # Upload/delete CV
    auth/              # Page login
  components/
    applications/      # Kanban, cards
    career-chat/       # Chat IA carriere
    dashboard/         # Dashboard stats
    jobs/              # Job list, cards, filters
    layout/            # Navbar, sidebar
    settings/          # Preferences, CV
    ui/                # shadcn/ui components
  lib/
    supabase/          # Client, queries
docs/
  plans/               # Plans d'implementation par phase
  IMPLEMENTATION_PLAN.md  # Plan master original
  BACKLOG.md           # Bugs et features a faire
supabase/
  migrations/          # 8 migrations SQL
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
9. **E2E Tests** : Playwright infrastructure + tests auth/jobs/apps/settings
10. **Export** : CSV + JSON export avec filtres
11. **Cowork API** : Endpoints pour Claude Cowork automation
12. **Agent Columns** : agent_status, ats_type, agent_notes sur applications

---

## Conventions

- **Sub-agents ne commitent pas** — seul l'orchestrateur fait les commits
- **Templates email** : beaux, responsifs, detailles mais pas complexes
- **Verifier visuellement avec Playwright AVANT de corriger des problemes UI**
- **i18n obligatoire** : toutes les strings UI dans messages/fr.json et messages/en.json
- **Zod validation** : tous les inputs API
- **Mobile-first** : tout design responsive, tester 375px
