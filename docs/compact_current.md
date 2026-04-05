# JobPilot - Compact Current

> Etat actuel du projet. Mis a jour a chaque session.
> Derniere mise a jour : 2026-04-04

---

## Dernier Commit

`1766fbd` merge: feat/scout-enhancements (latest)
`510602a` merge: feat/scout-endpoint
`245f0f2` docs: add comprehensive agent briefing
`2e1ac12` merge: feat/firecrawl-integration
`d16ccfc` merge: feat/score-refresh-cv-change

---

## Etat du Projet

**Branch** : main (clean, tout merge)
**Deploy** : Vercel production — deploye depuis `1766fbd`
**DB** : Supabase PostgreSQL (11 migrations, dont 011 firecrawl source)
**CVs** : 3 en rotation (Securite, Coordination, Large)
**AgentMail** : jobpilot-aziz@agentmail.to (actif)

---

## CONTEXTE — Session 2026-04-04

### Ce qui a ete fait (dans l'ordre)

**1. Corrections initiales**
- Push de 5 commits manquants (fresh-jobs pipeline enfin en production)
- Reset inbox : 23 jobs expires, clean slate pour du neuf

**2. Integration Firecrawl MCP (8 commits, branche mergee)**
- BUG-2 resolu : PDF parsing via Firecrawl parser v2 (Rust) au lieu de unpdf. Signed URL Supabase → Firecrawl scrape. `unpdf` retire des dependances.
- Firecrawl comme 3e source dans le pipeline fetch (a cote de JSearch/Adzuna). Migration 011. Degradation gracieuse si Firecrawl echoue.
- Deduplication amelioree : suffixes corp (Inc./Ltd.), variantes tech (React.js/React), provinces canadiennes (Ontario/ON). 6 tests.
- browser-apply v1 : workflow 3 phases (recon → decision → execution) via Firecrawl scrape + interact. Auto-apply Greenhouse/Lever/other. Escalade LinkedIn/Indeed/Workday. 13 tests.
- Document d'orchestration agent : `docs/agent-orchestration.md`
- Tests reels Firecrawl : PDF parsing, search+extract, reconnaissance — tous OK

**3. Endpoint Scout (2 commits, branche mergee)**
- `POST /api/cowork/scout` : 3 modes (targets, search, agent) pour decouverte proactive d'offres hors JSearch/Adzuna (Jobillico, Jobboom, pages carrieres employeurs). 6 tests.
- AgentMail configure (jobpilot-aziz@agentmail.to). browser-apply utilise cet email pour les candidatures.

**4. Ameliorations (2 commits, branche mergee)**
- Verification offres stagnantes : `stale-applications?check_urls=true` scrape les URLs via Firecrawl et detecte les offres fermees (404, "poste pourvu"). 5 tests.
- Workflows documentes : candidature par email via AgentMail, CV polyvalent, cibles Scout corrigees (pas Indeed/Glassdoor — deja couverts par JSearch).

**5. Configuration 3e CV + rotation 3 profils**
- CV "Polyvalent" uploade (txt, competences transferables, pas de mention securite, "disponible immediatement")
- Rotation mise a jour : Securite → Coordination → Large (cycle 3 jours)

**Fichiers cles ajoutes :**
- `src/lib/api/firecrawl.ts` — client wrapper SDK
- `src/lib/api/firecrawl-jobs.ts` — fetcher d'offres via search+extract
- `src/lib/services/browser-apply.ts` — service candidature 3 phases
- `src/lib/services/scout.ts` — service decouverte proactive (3 modes)
- `src/lib/services/stale-checker.ts` — verification offres fermees
- `src/app/api/cowork/scout/route.ts` — endpoint Scout
- `docs/agent-orchestration.md` — guide orchestration agent
- `docs/jobpilot-agent-briefing.md` — briefing complet pour Cowork
- `supabase/migrations/011_add_firecrawl_source.sql`

**Note SDK :** `@mendable/firecrawl-js` v4.18.1 (API v2). Zod v4 incompatible avec types Firecrawl (Zod v3) — JSON Schemas bruts au lieu de Zod natif.

**Tests ajoutes cette session :** 42 nouveaux tests (total projet : 274)

---

## Bugs Actifs

Aucun bug critique connu.
- ~~BUG-2 PDF parsing~~ : RESOLU via Firecrawl

---

## Backlog Features (par priorite)

### Haute — DONE
- ~~UX-4 Modale detail score IA~~ FAIT
- ~~Cowork next-actions endpoint~~ FAIT
- ~~Score refresh apres changement CV~~ FAIT
- ~~BUG-2 PDF parsing~~ RESOLU
- ~~Integration Firecrawl~~ FAIT
- ~~Endpoint Scout~~ FAIT

### Moyenne
- **[UX-3] Lettres de motivation par offre** : API existe, pas d'UI
- **Persistent Profiles Firecrawl** : sessions LinkedIn/Indeed persistantes pour browser-apply
- **Upload CV dans formulaires** : browser-apply ne gere pas l'upload PDF encore
- **Stale application escalation auto** : auto-needs_review 14j, auto-rejected 30j

### Basse
- **[UX-2] Page dediee CV** / **[UX-1] Assistant IA carriere**
- **Source health monitoring** / **Keyword effectiveness tracking**
- **Auto-cleanup cron** (orphelins cover_letters, seen_jobs stale)

---

## Points d'Attention

- **Vercel hobby timeout** : 60s max. Le Scout mode agent peut timeout — utiliser `maxCredits` pour limiter.
- **Firecrawl credits** : Free tier 500 credits. Scout targets ~3-5/URL, search ~5/resultat, agent ~10-50/mission.
- **Adzuna rate limit** : 2500 appels/mois. Cache 24h en DB.
- **JSearch** : 500 req/mois. Couvre deja Indeed/Glassdoor/LinkedIn — le Scout ne doit PAS re-scraper ces sources.
- **Fichiers CLAUDE.md parasites** : Les agents d'exploration laissent des CLAUDE.md vides. Nettoyer regulierement.

---

## Prochaine Action

**Quoi** : Donner le briefing a Cowork pour integrer Scout + browser-apply dans ses taches
**Documents** : `docs/jobpilot-agent-briefing.md` + `docs/agent-orchestration.md`
**Ensuite** : UX-3 (lettres de motivation UI) ou Persistent Profiles (LinkedIn auto-apply)
