# JobPilot - Compact Current

> Etat actuel du projet. Mis a jour a chaque session.
> Derniere mise a jour : 2026-03-28

---

## Dernier Commit

`e5d7993` fix(export): resolve merge conflicts — use profile.id, keep ApplicationForAgent type

---

## Etat du Projet

**Branch** : main (clean, aucun changement non commite)
**Deploy** : Vercel (production)
**DB** : Supabase PostgreSQL (8 migrations appliquees)

---

## Travail Recent (depuis dernier plan documente, 2026-02-06)

### Features livrees
- Export CSV/JSON avec filtres (jours, minScore, profil) + UI
- Load-more (25 jobs initiaux, +10 par clic)
- Dashboard unseen count (jobs actifs non vus)
- Cowork API endpoints pour automation Claude
- Agent columns (agent_status, ats_type, agent_notes) sur applications
- Query getReadyApplicationsForAgent + updateAgentStatus

### Bugs fixes
- Export auth (CRON_SECRET sur GET)
- CSV escaping multiline + profile_label
- Dashboard unseen count (subquery cassee -> 2-step)
- Hardcoded USER_ID -> dynamic profile lookup dans cowork routes
- Merge conflicts resolus (profile.id vs profile.user_id)

---

## Bugs Actifs

### [BUG-2] Upload PDF echoue en production Vercel (analyze-cv HTTP 500)
- **Priorite** : Haute
- **Cause** : pdf-parse incompatible Vercel Serverless. `unpdf` installe mais le bug persiste possiblement
- **Workaround** : Upload en .txt fonctionne

---

## Backlog Features (par priorite)

### Haute
- **[UX-4] Modale detail score IA** : ScoreCircle cliquable -> modale avec sous-scores, skills match/missing, strengths/concerns. Spec complete dans BACKLOG.md. Prete a implementer.

### Moyenne
- **[UX-3] Lettres de motivation par offre** : API existe (`/api/ai/cover-letter`) mais pas d'UI. Flux: bouton sur offre -> modale editeur -> sauvegarde dans application.

### Basse
- **[UX-2] Page dediee CV** : Transformer l'onglet CV en page complete `/settings/cv` avec profil IA, edition inline, score completude.
- **[UX-1] Assistant IA carriere** : Chat conversationnel qui lit le CV et suggere des directions. Tables DB existent deja (career_chat_sessions/messages).

---

## Points d'Attention

- **Vercel cron limit** : 10s max sur free tier. Fetch seulement dans le cron, scoring lazy.
- **Adzuna rate limit** : 2500 appels/mois. Cache 24h en DB.
- **Agent automation** : Les colonnes agent_status/ats_type/agent_notes sont en place mais l'agent candidature n'est pas encore construit.
- **Pas de plan documente apres Phase 8** : Les features post-phase 8 ont ete implementees en sessions ad hoc sans plan formel dans docs/plans/.

---

## Prochaine Session Suggeree

1. Fixer BUG-2 (PDF upload) si pas deja fait avec unpdf
2. Implementer UX-4 (modale detail score) — spec complete, ready to go
3. Ou continuer le travail agent automation selon les priorites utilisateur
