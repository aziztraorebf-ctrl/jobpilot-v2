# JobPilot - Compact Current

> Etat actuel du projet. Mis a jour a chaque session.
> Derniere mise a jour : 2026-03-29

---

## Dernier Commit

`8d0d3d3` chore: remove parasitic CLAUDE.md (latest)
`bd8dfa9` merge: feat/cowork-next-actions

---

## Etat du Projet

**Branch** : main (clean)
**Deploy** : Vercel production — READY, verifie E2E le 2026-03-29
**DB** : Supabase PostgreSQL (10 migrations appliquees, dont 009 RPC functions + 010 indexes)

---

## CONTEXTE — Ce qui s'est passe cette session (2026-03-29)

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
- Score refresh apres changement CV
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

### [BUG-2] Upload PDF echoue en production Vercel (analyze-cv HTTP 500)
- **Priorite** : Haute
- **Cause** : pdf-parse incompatible Vercel Serverless. `unpdf` installe mais le bug persiste possiblement
- **Workaround** : Upload en .txt fonctionne

---

## Backlog Features (par priorite)

### Haute — DONE
- ~~**[UX-4] Modale detail score IA**~~ : FAIT. ScoreDetailModal + route GET /api/ai/match-score-detail + cablage job-card/job-list + i18n.
- ~~**Cowork next-actions endpoint**~~ : FAIT. GET /api/cowork/next-actions — 5 regles de priorite, context dashboard, 8 tests.

### Moyenne
- **[UX-3] Lettres de motivation par offre** : API existe, pas d'UI.
- **Score refresh apres changement CV** : Scores figes sur ancien CV.
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

**Quoi** : UX-3 (lettres de motivation par offre) ou Score refresh apres changement CV
**Pourquoi** : UX-4 et next-actions sont faits. UX-3 est la prochaine feature a forte valeur produit (API existe, pas d'UI). Score refresh est un quick-win pour la coherence des scores.
**Comment** : Pour UX-3, spec partielle dans BACKLOG.md. Pour score refresh, identifier le trigger (CV update) et relancer le scoring.
