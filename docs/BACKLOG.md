# JobPilot — Backlog

Issues identifiées en production. Prioriser avant chaque session.

---

## Bugs

### [BUG-1] Cliquer "Postuler" crée automatiquement une candidature
**Priorité :** Haute
**Signalé :** 2026-02-28

**Comportement actuel :** Cliquer sur le bouton externe "Postuler" (qui ouvre le lien de l'offre) crée automatiquement une entrée dans le pipeline Candidatures avec le statut "Sauvegardée". Résultat : toute offre consultée se retrouve dans le pipeline, ce qui le rend rapidement inutilisable.

**Comportement attendu :** Seul le bouton bookmark (icône signet) doit créer une candidature. Le bouton "Postuler" doit uniquement ouvrir le lien externe sans effet de bord.

**Fichiers probables :** `src/components/jobs/job-card.tsx` — vérifier le `onClick` du bouton postuler.

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
