# JobPilot v2 -- Briefing Complet pour Agent Cowork

**Date :** 4 avril 2026
**Audience :** Agent IA (Claude Cowork / OpenClaw) qui pilote JobPilot
**Objectif :** Tout ce que l'agent doit savoir pour operer JobPilot de maniere autonome

---

## 1. Qu'est-ce que JobPilot

JobPilot est une application personnelle d'assistance a la recherche d'emploi, construite pour un seul utilisateur (Aziz). Elle automatise le cycle complet : decouverte d'offres, scoring IA, candidatures, et suivi.

L'app fonctionne en **mode 100% automatise**. Les offres arrivent automatiquement via un cron quotidien, sont scorees par IA, et les meilleures apparaissent dans le dashboard. L'agent peut ensuite postuler automatiquement sur les offres a formulaire simple, ou signaler celles qui necessitent une intervention humaine.

### Stack technique
- **Frontend/Backend :** Next.js 16 (App Router), TypeScript, React 19, TailwindCSS, shadcn/ui
- **Base de donnees :** Supabase PostgreSQL
- **IA scoring/parsing :** OpenAI GPT-4o-mini
- **Sources d'offres :** JSearch, Adzuna, Firecrawl (web scraping)
- **Automatisation navigateur :** Firecrawl scrape + interact
- **Email :** Resend + React Email
- **Deploiement :** Vercel (hobby tier, timeout 60s)

---

## 2. Le cycle quotidien

Le pipeline tourne automatiquement chaque jour :

| Heure (UTC) | Action | Detail |
|-------------|--------|--------|
| 2:00 AM | Expiration | Supprime les offres perimees : 3j si traitees, 7j si jamais vues, 30j max. Les offres avec une candidature active (saved/applying/applied/interview/offer) ne sont JAMAIS expirees. |
| 4:00 AM | Fetch + Score | Recherche des offres sur JSearch, Adzuna et Firecrawl en parallele. Deduplique, insere en base, score chaque offre vs le CV actif, desactive les scores trop bas, marque les scorees comme "vues". |
| 4:30 AM | Notifications | Envoie un email digest avec les meilleures offres du jour (score >= seuil d'alerte du profil). |

**L'agent peut aussi declencher des actions a la demande** via les endpoints Cowork decrits ci-dessous.

---

## 3. Les sources d'offres

### JSearch (API RapidAPI)
- Couverture internationale, metadonnees riches
- Quota : 500 requetes/mois
- Ideal pour les recherches structurees par mots-cles

### Adzuna (API directe)
- Fort sur le marche canadien, inclut les donnees salariales
- Quota : 2500 requetes/mois
- Fournit categorie, type de contrat, salaire predit ou reel

### Firecrawl (web scraping + IA) -- NOUVEAU
- Scrape n'importe quelle page web et extrait des donnees structurees via IA
- Pas de quota fixe, fonctionne par credits (surveiller la consommation)
- Ideal pour les sites que JSearch/Adzuna ne couvrent pas : Jobillico, Jobboom, pages carrieres d'employeurs directs
- Peut aussi parser des PDFs (utilise pour l'analyse de CV)

Les trois sources sont appelees en parallele. Si l'une echoue, les deux autres fonctionnent normalement.

### Deduplication
Les offres identiques entre sources sont detectees par un hash normalise (titre + entreprise + localisation). La normalisation gere :
- Variantes d'entreprise : "TechCorp Inc." = "TechCorp"
- Variantes tech : "React.js Developer" = "React Developer"
- Provinces canadiennes : "Toronto, Ontario, Canada" = "Toronto, ON, CA"

Quand un doublon est detecte, la version la plus riche en donnees est conservee.

---

## 4. Comment postuler automatiquement (browser-apply)

Le endpoint `/api/cowork/browser-apply` permet a l'agent de soumettre une candidature. Il fonctionne en 3 phases :

### Phase 1 : Reconnaissance
L'agent envoie l'URL de l'offre. Firecrawl scrape la page et analyse :
- Quel systeme de candidature (ATS) ? LinkedIn, Indeed, Workday, Greenhouse, Lever, autre ?
- Y a-t-il un formulaire de candidature visible ?
- Faut-il etre authentifie pour postuler ?
- Quels champs le formulaire demande (nom, email, CV, lettre de motivation) ?

### Phase 2 : Decision
Selon la reconnaissance, le systeme decide :

| Situation | Decision |
|-----------|----------|
| Formulaire simple, pas d'auth (Greenhouse, Lever, site employeur) | **Auto-apply** -- passe a la phase 3 |
| LinkedIn, Indeed | **needs_review** -- trop complexe, multi-etapes, auth requise |
| Workday | **needs_review** -- formulaires multi-pages avec auth |
| N'importe quel site avec authentification requise | **needs_review** |
| Pas de formulaire detecte | **needs_review** |

### Phase 3 : Execution
Pour les formulaires simples, Firecrawl `interact` remplit automatiquement :
- Nom complet (depuis le profil)
- Email (depuis le profil)
- Puis clique le bouton "Submit" / "Postuler"

Le resultat est enregistre dans la base : `agent_status` passe a "submitted" (succes) ou "failed" (echec), et les details sont stockes dans `agent_notes`.

### Ce que l'agent doit savoir
- **Ne jamais forcer** une candidature sur LinkedIn/Indeed/Workday -- toujours escalader
- **Verifier** que l'offre a un `source_url` valide avant d'appeler browser-apply
- **Ne pas re-postuler** si une application existe deja pour cette offre
- Un echec en phase 3 n'est pas grave -- noter l'erreur et passer a l'offre suivante

---

## 5. Les endpoints disponibles

Tous les endpoints `/api/cowork/*` et `/api/cron/*` requierent l'authentification via `CRON_SECRET` :
```
Authorization: Bearer <CRON_SECRET>
```
ou en query parameter : `?secret=<CRON_SECRET>`

---

### GET /api/cowork/next-actions

**Role :** L'endpoint de planification. Appeler en premier pour savoir quoi faire.

**Retourne :** Une liste d'actions prioritaires avec leur payload pret a executer.

**Types d'actions :**
- `fetch_jobs` (HIGH) -- le pipeline a besoin de nouvelles offres (moins de 10 non-vues ou aucune offre recente)
- `apply_high_match` (HIGH) -- des offres avec score >= 75 attendent. Le payload contient `job_listing_id` et `application_url` prets pour browser-apply
- `review_stale` (MEDIUM) -- des candidatures sont stagnantes depuis 7+ jours
- `notify_matches` (LOW) -- envoyer un email digest
- `idle` (LOW) -- rien a faire, tout va bien

**Exemple de reponse :**
```json
{
  "actions": [
    {
      "type": "apply_high_match",
      "priority": "high",
      "reason": "3 jobs with score >= 75 ready for application",
      "endpoint": "/api/cowork/browser-apply",
      "method": "POST",
      "payload": {
        "job_listing_id": "uuid-here",
        "application_url": "https://..."
      }
    }
  ],
  "context": {
    "unseenJobCount": 15,
    "activeJobs": 42,
    "staleApplicationCount": 2,
    "recentJobsFetched24h": 20
  }
}
```

---

### POST /api/cowork/fetch-and-score

**Role :** Declencher une recherche d'offres manuelle.

**Corps (optionnel) :**
```json
{
  "keywords": "security supervisor",
  "location": "Montreal",
  "sources": ["jsearch", "adzuna", "firecrawl"]
}
```
Si aucun corps n'est fourni, utilise les preferences de recherche du profil.

**Retourne :**
```json
{
  "fetched": 30,
  "inserted": 12,
  "scored": 5,
  "topMatches": [
    { "title": "Security Coordinator", "company": "Concordia", "score": 82 }
  ],
  "errors": []
}
```

---

### POST /api/cowork/browser-apply

**Role :** Postuler a une offre (workflow 3 phases decrit ci-dessus).

**Corps :**
```json
{
  "job_listing_id": "uuid-de-l-offre",
  "application_url": "https://url-de-candidature.com/apply",
  "resume_id": "uuid-du-cv"
}
```

**Retourne :**
```json
{
  "status": "submitted",
  "phase": "execution",
  "applicationId": "uuid",
  "message": "Application submitted via form automation"
}
```

ou si auto-apply impossible :
```json
{
  "status": "needs_review",
  "phase": "decision",
  "applicationId": "uuid",
  "atsType": "linkedin",
  "reason": "linkedin requires authentication and complex multi-step flow"
}
```

---

### POST /api/cowork/scout

**Role :** Decouverte proactive d'offres invisibles aux APIs (JSearch/Adzuna). Va chercher directement sur les pages carrieres, Jobillico, et partout ou les APIs ne vont pas.

**3 modes :**

**Mode targets** — pour les pages carrieres connues :
```json
{
  "mode": "targets",
  "urls": [
    "https://carrieres.stm.info/offres",
    "https://www.jobillico.com/recherche-emploi/montreal/quebec/temps-plein"
  ]
}
```

**Mode search** — recherche web large :
```json
{
  "mode": "search",
  "keywords": "emploi temps plein 21$ heure",
  "location": "Montreal",
  "limit": 10
}
```

**Mode agent** — navigation autonome pour sites complexes (pagination, filtres) :
```json
{
  "mode": "agent",
  "prompt": "Find all open security and customer service positions at STM paying between $20-25/hour",
  "urls": ["https://carrieres.stm.info"],
  "maxCredits": 50
}
```

**Retourne :**
```json
{
  "mode": "search",
  "discovered": 8,
  "inserted": 5,
  "scored": 5,
  "topMatches": [
    { "title": "Agent de securite", "company": "STM", "score": 78 }
  ],
  "errors": [],
  "creditsUsed": 15
}
```

**Quand utiliser quel mode :**
- `targets` : chaque jour sur les memes pages carrieres (cron quotidien)
- `search` : quand tu veux explorer de nouveaux types d'emplois
- `agent` : pour les sites complexes seulement (consomme plus de credits)

**Budget credits :** `maxCredits` dans le mode agent pour limiter. Targets ~3-5 credits/URL, search ~5/resultat, agent ~10-50 par mission.

---

### GET /api/cowork/stale-applications

**Role :** Lister les candidatures stagnantes (pas de changement depuis N jours).

**Parametres :** `?days=7` (par defaut)

**Retourne :** Liste des candidatures en status "applied" ou "interview" sans mise a jour recente.

---

### GET /api/cowork/dashboard-summary

**Role :** Vue d'ensemble de l'etat du pipeline.

**Retourne :**
```json
{
  "preferences": { "keywords": [...], "location": "Montreal", ... },
  "dashboard": {
    "activeJobs": 42,
    "totalApplications": 15,
    "statusCounts": { "saved": 5, "applied": 8, "interview": 2 },
    "recentJobsFetched24h": 20,
    "staleApplicationCount": 3,
    "unseenJobCount": 12
  }
}
```

---

### POST /api/cowork/notify

**Role :** Envoyer un email de notification.

**Corps :**
```json
{
  "type": "new_matches",
  "data": {
    "jobs": [
      { "title": "Dev", "company": "Acme", "overallScore": 85, "sourceUrl": "..." }
    ],
    "totalFetched": 30,
    "totalScored": 5
  }
}
```

---

## 6. La base de donnees -- colonnes cles

### Table job_listings
| Colonne | Role |
|---------|------|
| `source` | Origine : jooble, adzuna, jsearch, firecrawl, manual |
| `dedup_hash` | Hash unique pour deduplication |
| `is_active` | false = expire ou desactive par scoring |
| `profile_label` | Quel profil de recherche a trouve cette offre |

### Table applications
| Colonne | Role |
|---------|------|
| `status` | Statut visible : saved, applying, applied, interview, offer, accepted, rejected, withdrawn |
| `agent_status` | Statut agent : pending, ready, submitted, failed, needs_review |
| `ats_type` | Type d'ATS : linkedin, indeed, workday, greenhouse, lever, other |
| `agent_notes` | Notes libres de l'agent (erreurs, details recon, resultats) |
| `application_url` | URL de candidature |

### Cycle de vie d'une candidature
```
next-actions retourne apply_high_match
  -> appeler browser-apply avec job_listing_id + application_url
    -> Phase 1 : recon -> ats_type mis a jour
    -> Phase 2 : decision
      -> canAutomate=true -> Phase 3
        -> succes : agent_status="submitted", status="applied"
        -> echec : agent_status="failed", agent_notes="raison"
      -> canAutomate=false -> agent_status="needs_review"
```

### Table match_scores
| Colonne | Role |
|---------|------|
| `overall_score` | Score global 0-100 |
| `skill_score` | Score competences |
| `matching_skills` | Competences correspondantes (array) |
| `missing_skills` | Competences manquantes (array) |

---

## 7. Regles de decision pour l'agent

### Quand fetcher des offres
- `unseenJobCount < 10` (l'inbox est presque vide)
- `recentJobsFetched24h === 0` (rien de nouveau depuis 24h)
- L'utilisateur le demande explicitement

### Quand postuler
- L'offre a un `overall_score >= 75`
- L'offre a un `source_url` valide
- Aucune application n'existe deja pour cette offre
- Appeler browser-apply et traiter le resultat

### Quand escalader a l'humain
- `agent_status = "needs_review"` : l'agent ne peut pas automatiser cette candidature
- 3+ echecs consecutifs : possible probleme systemique (credits, rate limit, bug)
- L'offre requiert un document supplementaire (portfolio, lettre specifique)

### Quand notifier
- Apres un fetch qui trouve des offres a score eleve
- Quand des candidatures sont stagnantes depuis 7+ jours

---

## 8. Gestion des credits Firecrawl

Chaque operation Firecrawl consomme des credits :
- **Scrape simple** : 1-3 credits
- **Search + extract** : ~5 credits par resultat avec JSON
- **browser-apply** (scrape + interact) : 5-10 credits par tentative

Pour un usage normal (quelques dizaines d'offres/jour, quelques candidatures/semaine), le free tier devrait suffire. Si les credits baissent, prioriser JSearch/Adzuna pour les recherches et reserver Firecrawl pour :
1. Les sources que JSearch/Adzuna ne couvrent pas
2. Les candidatures browser-apply

---

## 9. Erreurs courantes et comment reagir

| Erreur | Cause probable | Action |
|--------|---------------|--------|
| 401 Unauthorized | CRON_SECRET manquant ou incorrect | Verifier le header Authorization |
| `RESUME_NOT_FOUND` | Pas de CV uploade | Demander a l'utilisateur d'uploader un CV |
| `VALIDATION_ERROR` | Corps de requete invalide | Corriger le payload et reessayer |
| `INTERNAL_ERROR` | Erreur serveur | Logger et reessayer une fois |
| browser-apply `"failed"` phase recon | Page inaccessible ou timeout Firecrawl | Logger, passer a l'offre suivante |
| browser-apply `"needs_review"` | ATS complexe ou auth requise | Signaler a l'utilisateur, ne pas reessayer |
| Firecrawl timeout | Site lent ou charge elevee | Reessayer une fois, sinon passer |

---

## 10. Ce qui n'est PAS encore implemente

- **Persistent Profiles Firecrawl** : S'authentifier une fois sur LinkedIn/Indeed et reutiliser la session. Aujourd'hui, ces sites sont toujours escalades a `needs_review`.
- **Upload automatique de CV** dans les formulaires : Le browser-apply remplit nom/email mais ne gere pas encore l'upload de fichier PDF.
- **Lettres de motivation** : L'API de generation existe (`/api/ai/cover-letter`) mais il n'y a pas d'UI ni d'integration dans browser-apply.
- **Suivi post-candidature** : Verifier si une offre est toujours active via Firecrawl scrape (planifie mais pas implemente).
- **Stale application escalation automatique** : Changer automatiquement le statut apres 14j/30j (planifie).

---

## 11. URL de base

- **Production :** L'URL Vercel du projet (verifier dans le dashboard Vercel)
- **Local :** `http://localhost:3000`

Tous les endpoints se prefixent avec cette URL de base.

---

## 12. AgentMail

L'agent dispose de sa propre adresse email : **jobpilot-aziz@agentmail.to**

Cette adresse est utilisee automatiquement par browser-apply quand il remplit les formulaires de candidature. Les confirmations d'employeurs arrivent dans cette boite, pas dans l'email personnel d'Aziz.

L'agent peut consulter cette boite via les outils MCP AgentMail (list_threads, get_thread) pour verifier les confirmations.

---

## 13. Resume -- Workflow type de l'agent

**Cycle 1 — Veille (matin, apres le cron) :**
```
1. Appeler GET /api/cowork/next-actions
2. Lire les actions retournees, par priorite :
   a. Si fetch_jobs : appeler POST /api/cowork/fetch-and-score
   b. Si apply_high_match : pour chaque offre,
      appeler POST /api/cowork/browser-apply avec le payload
   c. Si review_stale : noter les candidatures stagnantes
   d. Si notify_matches : appeler POST /api/cowork/notify
   e. Si idle : passer au cycle 2
```

**Cycle 2 — Scout (apres la veille) :**
```
1. Appeler POST /api/cowork/scout en mode "targets"
   avec les pages carrieres habituelles (STM, Ville de Montreal, Jobillico, etc.)
2. Appeler POST /api/cowork/scout en mode "search"
   avec des mots-cles larges ("emploi 21$/h Montreal", "embauche rapide", etc.)
3. Si besoin d'explorer un site complexe : mode "agent" (attention aux credits)
4. Reporter les decouvertes a l'utilisateur
5. Si des offres a score eleve ont un formulaire simple :
   proposer de postuler via browser-apply (validation humaine)
```
