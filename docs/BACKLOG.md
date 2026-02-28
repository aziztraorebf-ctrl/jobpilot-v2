# JobPilot — Backlog

Issues identifiées en production. Prioriser avant chaque session.

---

## Bugs

### ~~[BUG-1] Cliquer "Postuler" crée automatiquement une candidature~~ ✅ Résolu
**Résolu :** 2026-02-28 — `handleApply` dans `job-card.tsx` n'ouvre plus que le lien externe.

---

## Améliorations UX

### [UX-1] Assistant IA conversationnel pour l'exploration de carrière
**Priorité :** Basse (feature complexe)
**Signalé :** 2026-02-28

Un chat IA intégré qui :
- Lit le CV uploadé
- Discute du parcours et des objectifs du candidat
- Suggère des directions de carrière
- Met à jour automatiquement les préférences de recherche en Supabase suite à la conversation

Stack envisagé : OpenAI + Supabase (stockage des messages de conversation).

---
