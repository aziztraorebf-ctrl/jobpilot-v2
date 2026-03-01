# JobPilot — Backlog

Issues identifiées en production. Prioriser avant chaque session.

---

## Bugs

### ~~[BUG-1] Cliquer "Postuler" crée automatiquement une candidature~~ ✅ Résolu
**Résolu :** 2026-02-28 — `handleApply` dans `job-card.tsx` n'ouvre plus que le lien externe.

---

## Bugs actifs

### [BUG-2] Upload PDF échoue en production Vercel (analyze-cv HTTP 500)
**Priorité :** Haute
**Signalé :** 2026-02-28

`pdf-parse@1.1.1` avec `createRequire + lib/pdf-parse.js` retourne toujours 500 sur Vercel Serverless lors du clic "Analyser avec l'IA" pour les fichiers PDF. Les fichiers TXT fonctionnent correctement.

**Pistes à investiguer :**
- Vercel Serverless ne peut pas lire les fichiers statiques embarqués dans `pdf-parse` (pdfjs-dist workers, cmaps) lors de l'exécution
- Alternative : utiliser `pdfjs-dist` directement avec configuration sans workers, ou `unpdf` (lib légère pour Vercel Edge/Serverless)
- Alternative 2 : côté client, extraire le texte du PDF dans le navigateur avant upload (via `pdfjs-dist` en mode browser)

**Workaround actuel :** Uploader le CV en `.txt` fonctionne.

---

## Améliorations UX

### [UX-2] Page dédiée CV avec profil IA complet (Option C)
**Priorité :** Basse — implémenter seulement si la modale (Option B) s'avère insuffisante
**Signalé :** 2026-02-28

Transformer l'onglet CV en une vraie page `/settings/cv` avec :
- Vue "profil IA" complète et bien structurée (pas une modale)
- Édition inline des données extraites (compétences, expériences)
- Score de complétude du profil
- Connexion visuelle claire avec les offres et les lettres de motivation

**Dépendance :** Valider d'abord que la modale Option B répond au besoin utilisateur.

---

### [UX-3] Lettres de motivation par offre d'emploi
**Priorité :** Moyenne (feature clé pour la valeur produit)
**Signalé :** 2026-02-28

L'API `/api/ai/cover-letter` existe mais n'est pas accessible dans l'UI. Feature complète à construire :

**Flux envisagé :**
1. Sur une offre sauvegardée (statut "saved" ou "applying"), afficher un bouton "Générer une lettre de motivation"
2. Prérequis : CV analysé. Si absent, rediriger vers Settings > CV.
3. Génération basée sur : profil CV (`parsed_data`) + description complète de l'offre + préférences langue/ton
4. Résultat affiché dans une modale avec éditeur texte simple (pas WYSIWYG)
5. L'utilisateur peut : copier, relancer la génération, ou discuter avec l'IA pour affiner

**Complexité estimée :** Moyenne (2-3 sessions)
- Bouton dans `job-card.tsx` ou page candidature
- Modale avec éditeur + actions
- Possibilité de sauvegarder la lettre dans la candidature (`applications.cover_letter` — colonne à ajouter)

---

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
