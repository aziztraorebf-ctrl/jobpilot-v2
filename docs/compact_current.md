# JobPilot - Compact Current

> Etat actuel du projet. Mis a jour a chaque session.
> Derniere mise a jour : 2026-04-04 (session 2)

---

## Dernier Commit

`d16ccfc` merge: feat/score-refresh-cv-change
Branch en cours: `feat/firecrawl-integration` (7 commits, a merger)
`0bd8f94` docs: mark score-refresh-on-cv-change as implemented
`5c22559` test(analyze-cv): add tests for automatic score refresh on CV re-analysis
`7ffa08b` feat(analyze-cv): auto re-score active jobs when CV is re-analyzed
`d363563` feat(queries): add getActiveJobsByIds for batch active job lookup

---

## Etat du Projet

**Branch** : main (clean)
**Deploy** : Vercel production — READY, verifie E2E le 2026-03-29
**DB** : Supabase PostgreSQL (10 migrations appliquees, dont 009 RPC functions + 010 indexes)

---

## CONTEXTE — Session 2026-04-04 (2)

### Integration Firecrawl MCP — en cours (branche feat/firecrawl-integration)

1. **BUG-2 resolu** : PDF parsing remplace unpdf par Firecrawl PDF parser v2 (Rust). Le PDF n'est plus telecharge sur Vercel — seule une signed URL est passee a Firecrawl. `unpdf` retire des dependances.

2. **Source Firecrawl ajoutee au pipeline** : `firecrawl_search` + JSON schema extraction comme 3e source a cote de JSearch et Adzuna. Migration 011 pour le CHECK constraint. Degradation gracieuse — si Firecrawl echoue, les autres sources fonctionnent.

3. **Deduplication amelioree** : normalisation etendue avant hash SHA-256 (suffixes corp, variantes tech React.js/React, provinces canadiennes Ontario/ON, suppression ponctuation). 6 nouveaux tests.

4. **browser-apply v1 fonctionnel** : workflow 3 phases (reconnaissance, decision, execution) via `firecrawl scrape` + `firecrawl interact`. Auto-apply pour Greenhouse/Lever/other avec formulaire simple. Escalade `needs_review` pour LinkedIn/Indeed/Workday/auth. 13 tests. Nouvelle query `updateAtsType`.

5. **Document d'orchestration agent** : `docs/agent-orchestration.md` — cycle quotidien, surface API, regles de decision, gestion credits, colonnes agent.

**Fichiers cles ajoutes :**
- `src/lib/api/firecrawl.ts` — client wrapper + extractPdfTextFromUrl
- `src/lib/api/firecrawl-jobs.ts` — fetcher d'offres via search+extract
- `src/lib/services/browser-apply.ts` — service 3 phases
- `docs/agent-orchestration.md` — guide orchestration agent
- `supabase/migrations/011_add_firecrawl_source.sql`

**Note SDK :** Le package est `@mendable/firecrawl-js` v4.18.1 (API v2). Zod v4 est incompatible avec les types Firecrawl (importent Zod v3) — on passe des JSON Schemas bruts au lieu de schemas Zod natifs.

---

## CONTEXTE — Session 2026-04-04 (1)

### Score refresh on CV change — implemente

Quand un utilisateur re-analyse son CV (`analyze-cv`), les scores des jobs actifs precedemment scores avec ce CV sont automatiquement recalcules. Implementation fire-and-forget (non-bloquant pour l'utilisateur), cap a 10 jobs pour rester dans le timeout Vercel 60s. Les jobs restants seront rescores par le prochain cron.

**Fichiers modifies :** `queries/jobs.ts` (nouvelle query `getActiveJobsByIds`), `analyze-cv/route.ts` (helper `refreshScoresForResume`), 4 tests.

**Note technique :** Zod v4 rejette les UUID nil (`00000000-...`) — seuls les UUID v1-v8 valides ou le nil/max canoniques passent. Les tests utilisent un UUID v4 synthetique.

---

## CONTEXTE — Session 2026-03-29

### Probleme diagnostique : memes offres jour apres jour

L'utilisateur voyait les memes jobs chaque jour malgre le cron quotidien. Investigation approfondie a revele un probleme multi-couche :

1. **Cause racine** : `inbox_limit` (200) bloquait le cron fetch ENTIEREMENT quand 200+ jobs non-vus
2. **Causes secondaires** : Dashboard sans filtre seen, expiry trop lente (30j pour jobs vus), pas de auto-mark seen apres scoring, cowork API ne distinguait pas jobs frais vs total

### Decision architecturale : passage 100% automatise

L'app etait concue pour un usage mixte (manuel + automatise). Maintenant elle est 100% automatisee. L'architecture a ete adaptee : le cron fetch toujours, les jobs traites expirent en 3j, l'inbox ne montre que du neuf.

### Deux plans executes et merges

**Plan 1 : Fresh Jobs Pipeline** (7 commits)
- Suppression inbox_limit blocking
- Auto-expire : 3j processed, 7j unseen, 30j absolute (jobs avec candidature active proteges)
- Dashboard en mode inbox (jobs frais uniquement)
- `unseenJobCount` dans cowork dashboard-summary
- Auto-mark seen apres scoring (cron + cowork)

**Plan 2 : Robustness Tier 1+2** (7 commits)
- Queries NOT IN string concat -> RPC Postgres anti-joins (migration 009)
- 4 indexes de performance (migration 010)
- Auth cron unifiee sur `verifyCronSecret()`
- Codes d'erreur specifiques (`INTERNAL_ERROR`, `VALIDATION_ERROR`, `RESUME_NOT_FOUND`, etc.)
- browser-apply retourne 201 au lieu de 501
- Auto-scorer logging ameliore
- Cron timing reordonne : expire 2AM -> fetch 4AM -> notifications 4:30AM UTC

### Audit complet realise

Un audit de robustesse a identifie des problemes supplementaires. Les Tier 1 et Tier 2 sont corriges. Reste le Tier 3 (opportunites d'automatisation) :

- ~~`/api/cowork/next-actions` — endpoint qui dit a l'agent quoi faire~~ DONE
- ~~Score refresh apres changement CV~~ DONE
- Stale application escalation auto
- Source health monitoring
- Keyword effectiveness tracking
- Auto-cleanup cron (orphelins)

### Tests E2E en production — 9/9 OK

| Test | Resultat |
|------|----------|
| Health | OK |
| Dashboard summary + unseenJobCount | OK (49 unseen, 19 recents 24h) |
| Expire jobs (RPC) | OK (25 expires) |
| Fetch jobs (plus de blocage) | OK (200, nouveaux jobs fetches) |
| Stale applications | OK |
| Auth refusee sans secret | OK (401) |
| Auth refusee mauvais secret | OK (401) |
| Browser-apply error codes | OK (INTERNAL_ERROR + context) |
| Dashboard apres expire | OK (65 -> 54 actifs) |

---

## Bugs Actifs

### ~~[BUG-2] Upload PDF echoue en production Vercel~~ RESOLU
- **Fix** : Remplace unpdf par Firecrawl PDF parser v2 (branche feat/firecrawl-integration)
- **Methode** : Signed URL Supabase -> Firecrawl scrape avec parsers: ["pdf"]

---

## Backlog Features (par priorite)

### Haute — DONE
- ~~**[UX-4] Modale detail score IA**~~ : FAIT. ScoreDetailModal + route GET /api/ai/match-score-detail + cablage job-card/job-list + i18n.
- ~~**Cowork next-actions endpoint**~~ : FAIT. GET /api/cowork/next-actions — 5 regles de priorite, context dashboard, 8 tests.

### Moyenne
- **[UX-3] Lettres de motivation par offre** : API existe, pas d'UI.
- ~~**Score refresh apres changement CV**~~ : FAIT. Fire-and-forget re-scoring dans analyze-cv, cap 10 jobs, 4 tests.
- **Stale application escalation** : Auto-needs_review apres 14j, auto-rejected apres 30j.

### Basse
- **[UX-2] Page dediee CV** / **[UX-1] Assistant IA carriere**
- **Source health monitoring** / **Keyword effectiveness tracking**
- **Auto-cleanup cron** (orphelins cover_letters, seen_jobs stale)

---

## Points d'Attention

- **Vercel hobby timeout** : 60s max. Le fetch-jobs peut timeout si scoring trop lourd — fonctionne mais au limite.
- **Adzuna rate limit** : 2500 appels/mois. Cache 24h en DB.
- **Triggers schedules** : Aucun trigger Claude Code schedule n'existe (liste vide). A creer si besoin.
- **Fichiers CLAUDE.md parasites** : Les agents d'exploration laissent des CLAUDE.md dans les sous-dossiers. Nettoyer regulierement.

---

## Prochaine Action

**Quoi** : Merger `feat/firecrawl-integration`, appliquer migration 011, deployer, tester en production
**Ensuite** : UX-3 (lettres de motivation par offre) ou ameliorations browser-apply (Persistent Profiles pour LinkedIn)
