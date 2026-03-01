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

### [UX-4] Modale de détail du score IA par offre (cercle cliquable)
**Priorité :** Haute — feature AutoCloud prête à implémenter
**Signalé :** 2026-02-28

#### Contexte

Chaque job card affiche un `ScoreCircle` (cercle SVG avec le score global). Les données détaillées du score sont déjà sauvegardées en DB dans `match_scores` mais jamais affichées. Un utilisateur en reconversion ne sait pas pourquoi son score est bas, ni quels gaps combler.

#### Ce qu'il faut construire

**1. Route API : `GET /api/ai/match-score?jobId=<uuid>`**

- Authentification via `requireUser()`
- Récupère dans `match_scores` la ligne correspondant à `user_id + job_listing_id` (le plus récent si plusieurs)
- Retourne : `{ overall_score, skill_match_score, experience_match_score, education_match_score, explanation, matching_skills, missing_skills, strengths, concerns }` ou `null` si pas de score
- Utiliser `getSupabase()` et la query existante `getScoreForJob` dans `src/lib/supabase/queries/scores.ts` — mais cette fonction prend aussi `resumeId`. Adapter : récupérer le score le plus récent pour `user_id + job_listing_id` sans filtrer sur `resume_id`.

**2. Composant `ScoreDetailModal`**

Fichier : `src/components/jobs/score-detail-modal.tsx`

- Dialog shadcn/ui (`src/components/ui/dialog.tsx` existe)
- Props : `jobId: string`, `jobTitle: string`, `open: boolean`, `onClose: () => void`
- Au mount (quand `open` passe à `true`) : fetch `GET /api/ai/match-score?jobId=...`
- Affiche un spinner pendant le chargement
- Si pas de score : message "Aucun score disponible pour cette offre. Cliquez sur Scorer avec l'IA depuis la liste des offres."

**Contenu de la modale quand score disponible :**

```
[Titre du poste]
Score global : [ScoreCircle lg] — [explication en texte complet]

Sous-scores :
  Compétences     [barre de progression] XX%
  Expérience      [barre de progression] XX%
  Formation       [barre de progression] XX%

Compétences correspondantes : [badges verts]
Compétences manquantes :      [badges rouges]

Points forts :        [liste avec checkmark vert]
Points de vigilance : [liste avec triangle orange]
```

- Utiliser `Progress` de shadcn/ui si disponible, sinon une `<div>` avec `style={{ width: X% }}`
- Badges : `<Badge>` de `src/components/ui/badge.tsx`
- Pas de bouton "Rescorer", pas de lien vers Settings

**3. Rendre `ScoreCircle` cliquable dans `JobCard`**

Fichier : `src/components/jobs/job-card.tsx`

- Ajouter props `onScoreClick?: (jobId: string) => void` à `JobCardProps`
- Wrapper le `<ScoreCircle>` dans un `<button>` avec `onClick={() => onScoreClick?.(jobId)}` uniquement si `score > 0`
- Si `score === 0` : le cercle reste non-cliquable (pas encore scoré)
- Cursor pointer + `title="Voir le détail du score"`

**4. Connecter dans `JobList`**

Fichier : `src/components/jobs/job-list.tsx`

- Ajouter state : `const [scoreModalJob, setScoreModalJob] = useState<{ id: string; title: string } | null>(null)`
- Passer `onScoreClick={(jobId) => setScoreModalJob({ id: jobId, title: job.title })}` à chaque `JobCard`
- Rendre `<ScoreDetailModal>` en bas du composant

#### Données réelles disponibles en DB (exemple)

```json
{
  "overall_score": 15,
  "skill_match_score": 10,
  "experience_match_score": 20,
  "education_match_score": 10,
  "explanation": "Le candidat possède une solide expérience en coordination mais n'a pas d'expérience directe en développement logiciel...",
  "matching_skills": ["Coordination", "Communication"],
  "missing_skills": ["C, C++, Java, Python", "React, TypeScript", "GitLab"],
  "strengths": ["Professionnel fiable", "Expérience en environnement à forte fréquentation"],
  "concerns": ["Aucune expérience en développement logiciel", "Manque de formation en informatique"]
}
```

#### Fichiers clés à lire avant d'implémenter

- `src/components/ui/score-circle.tsx` — le composant SVG existant
- `src/components/jobs/job-card.tsx` — où ajouter `onScoreClick`
- `src/components/jobs/job-list.tsx` — où gérer le state de la modale
- `src/lib/supabase/queries/scores.ts` — `getScoreForJob`, `getScoreMap`
- `src/app/api/ai/match-score/route.ts` — route POST existante (créer GET séparé)
- `messages/fr.json` et `messages/en.json` — ajouter les clés i18n sous `"jobs"`

#### Traductions à ajouter (fr/en)

```json
// fr
"scoreDetail": "Détail du score",
"scoreSubSkills": "Compétences",
"scoreSubExperience": "Expérience",
"scoreSubEducation": "Formation",
"scoreMatchingSkills": "Compétences correspondantes",
"scoreMissingSkills": "Compétences manquantes",
"scoreStrengths": "Points forts",
"scoreConcerns": "Points de vigilance",
"scoreNotAvailable": "Aucun score disponible. Cliquez sur \"Scorer avec l'IA\" depuis la liste des offres.",
"scoreLoading": "Chargement du score..."

// en
"scoreDetail": "Score breakdown",
"scoreSubSkills": "Skills",
"scoreSubExperience": "Experience",
"scoreSubEducation": "Education",
"scoreMatchingSkills": "Matching skills",
"scoreMissingSkills": "Missing skills",
"scoreStrengths": "Strengths",
"scoreConcerns": "Concerns",
"scoreNotAvailable": "No score available. Click \"Score with AI\" from the job list.",
"scoreLoading": "Loading score..."
```

#### Contraintes

- Pas d'édition, pas de rescoring depuis la modale
- Pas de lien vers Settings CV
- Mobile-first : la modale doit être lisible sur 375px de large
- Aucune nouvelle dépendance npm

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
