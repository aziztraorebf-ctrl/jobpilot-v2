# Plan — Fix notifications, AgentMail, observabilité

**Date** : 2026-05-20
**Branche** : `fix/notifications-and-observability`
**Contexte** : audit externe + audit interne révèlent que la couche notification est cassée depuis le launch (pas seulement avril). Bug racine identifié + silenciation systémique des erreurs email.

---

## Diagnostic confirmé (preuves dans le code)

### Bug racine #1 — Payload wrapping next-actions → notify
- [src/app/api/cowork/next-actions/route.ts:104-126](../../src/app/api/cowork/next-actions/route.ts#L104-L126) construit une action avec `payload: { type, data: {...} }`
- Mais l'action n'est qu'une **description JSON** retournée au caller, elle n'appelle jamais réellement `/api/cowork/notify`. Le payload est **structurellement correct** pour `notify` (`{type, data}`).
- **Conclusion** : le wrapping n'est pas le bug. `next-actions` est un endpoint qui suggère des actions à un orchestrateur externe (scout agent). Le scout devait probablement extraire `action.payload` et le POSTer à `notify` — si le scout envoyait l'objet `action` complet au lieu d'`action.payload`, Zod recevait `{ type, priority, reason, endpoint, method, payload, data }` au lieu de `{ type, data }`, et le `type` matchait quand même l'enum (`new_matches`) mais `data` était `undefined`.

**Fix** : pas de changement dans `notify` (le code est correct). Le fix est côté caller (scout agent externe). Côté repo, on **renforce notify** pour donner une erreur 400 explicite qui aide à debug.

### Bug racine #2 — sendEmail() silencieux dans les crons
Preuves :
- [src/app/api/cron/notifications/route.ts:71](../../src/app/api/cron/notifications/route.ts#L71) — `await sendEmail(...)` sans capture du résultat, `emailsSent++` ligne 75 incrémenté inconditionnellement
- [src/app/api/cron/notifications/route.ts:105](../../src/app/api/cron/notifications/route.ts#L105) — idem
- [src/app/api/cron/fetch-jobs/route.ts:160](../../src/app/api/cron/fetch-jobs/route.ts#L160) — idem (alerte high-score jobs)

Contre-exemple correct :
- [src/app/api/cowork/notify/route.ts:76-84](../../src/app/api/cowork/notify/route.ts#L76-L84) — pattern propre : capture `result`, check `success`, log + retourne 500

### Bug racine #3 — Aucun monitoring
- Zéro `@sentry` dans le code
- `console.error` seul → invisible une fois Vercel rotate les logs
- Vercel cron retourne HTTP 200 même quand l'email plante (parce que `sendEmail` swallow)

### AgentMail — intégration inexistante
- [.env.example:29-30](../../.env.example#L29-L30) déclare seulement `AGENT_EMAIL=jobpilot-aziz@agentmail.to`
- [.env.local:38-39](../../.env.local#L38-L39) **n'a aucune var AgentMail**
- [src/app/api/cowork/browser-apply/route.ts:103-104](../../src/app/api/cowork/browser-apply/route.ts#L103-L104) lit `process.env.AGENT_EMAIL` juste pour remplir un formulaire
- **Aucun code n'appelle l'API AgentMail** → impossible d'envoyer un email depuis cette inbox

### Firecrawl/Tavily — dégradation silencieuse
- [src/lib/services/deduplicator.ts](../../src/lib/services/deduplicator.ts) ne filtre PAS les URLs de listing (`/recherche-emploi/`, `/search`, `/browse`)
- [src/app/api/cron/fetch-jobs/route.ts:75](../../src/app/api/cron/fetch-jobs/route.ts#L75) — Firecrawl n'est PAS dans le cron quotidien (seulement Scout mode)
- Quand Tavily renvoie une page catégorie, le snippet est scoré comme description → score faible → désactivé silencieusement

---

## Phase 1 — Stop the bleeding (priorité critique)

### 1.1 Fix `sendEmail()` silencieux (3 endroits)
**Fichiers** : `cron/notifications/route.ts` lignes 71+75 et 105+109, `cron/fetch-jobs/route.ts` ligne 160.

**⚠️ Attention ordre actuel** :
- Dans `notifications/route.ts`, `await sendEmail()` (l.71) et `emailsSent++` (l.75) sont sur des lignes séparées. Même chose l.105 et l.109.
- **Le fix doit fusionner ces 2 lignes** en capturant `result`, checkant `success`, et n'incrémentant qu'après le check.

**Pattern à appliquer** (copié de notify/route.ts:76-84) :
```ts
const result = await sendEmail({ subject, html });
if (!result.success) {
  console.error("[cron <name>] sendEmail failed:", result.error);
  emailsFailed++;
  throw new Error(`Email send failed: ${result.error}`);
}
emailsSent++;
```

**Tracker `emailsFailed`** : ajouter `let emailsFailed = 0` en début de cron, l'inclure dans la réponse finale, et retourner HTTP 500 si `emailsFailed > 0` :

```ts
return NextResponse.json(
  { message: "Notifications sent", emailsSent, emailsFailed },
  { status: emailsFailed > 0 ? 500 : 200 }
);
```

**Comportement attendu** : si l'email échoue pour un profil, l'erreur remonte dans le catch par-profil (qui log déjà avec contexte). La boucle continue pour les autres profils (vérifié : `for (const profile of profiles)` enveloppe un try/catch interne). Le cron retournera 500 si au moins un email a échoué → visible dans le dashboard Vercel.

### 1.2 Renforcer la réponse 400 de `/api/cowork/notify`
**Fichier** : `cowork/notify/route.ts:87-92`

Ajouter un cas spécifique ZodError qui retourne **400 + détail des champs manquants** (au lieu de 500 générique via apiError).

**⚠️ Filtrer `zod_issues`** : Zod inclut parfois `received: <valeur>` dans les issues (ex: `invalid_enum_value`). Si un caller envoie par erreur un token/email dans un champ, ça leak dans la réponse. Whitelist explicite :

```ts
if (error instanceof ZodError) {
  const safeIssues = error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
    // explicit allow-list — NE PAS exposer issue.received ni issue.input
  }));
  return NextResponse.json({
    error: "Invalid payload structure",
    expected: "{ type: 'new_matches' | 'stale_reminder', data: object }",
    received_keys: raw && typeof raw === "object" ? Object.keys(raw) : null,
    zod_issues: safeIssues,
  }, { status: 400 });
}
```

**Bonus refactor (M3)** : extraire ce pattern dans `src/lib/api/error-response.ts` comme `zodErrorResponse(error, expected)` pour réutilisation future (scout, fetch-and-score, browser-apply, jobs/dismiss, jobs/search ont tous le même pattern). ~30 min, fait une fois.

Le scout (caller externe) verra immédiatement ce qu'il envoie de travers. L'endpoint est protégé par `verifyCronSecret()` donc pas d'exposition publique.

### 1.3 Ajouter les vars AgentMail
**Fichiers** : `.env.example` + `.env.local`

```
# AgentMail (agent's dedicated email for job applications)
AGENT_EMAIL=jobpilot-aziz@agentmail.to
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=
```

Dans `.env.local`, on ajoute les lignes vides — toi tu remplis avec tes vraies valeurs.

**Note importante** : ajouter ces vars **n'envoie aucun email**. C'est juste la préparation pour Phase 2. Le code qui consomme ces vars n'existe pas encore.

### Commits Phase 1
1. `fix(cron): capture sendEmail results to surface email failures`
2. `feat(api): notify endpoint returns explicit 400 with diagnostic on bad payload`
3. `chore(env): add AgentMail API credentials placeholders`

---

## Phase 2 — Construire le client AgentMail

### 2.1 Créer `src/lib/api/agentmail.ts`
Nouveau client minimal :
- Constructor : lit `AGENTMAIL_API_KEY` + `AGENTMAIL_INBOX_ID` de l'env, throw si manquant
- Méthode `sendMessage({ to, subject, body, html? })` → POST `/inboxes/{id}/messages/send` avec `Authorization: Bearer ${key}`
- Retourne `{ success: boolean, messageId?: string, error?: string }` (même contrat que sendEmail pour cohérence)
- **Validation Context7-First** : avant d'écrire, vérifier la doc officielle AgentMail via WebFetch (l'audit externe affirme l'endpoint mais on confirme)

### 2.2 Tests unitaires
- `src/lib/api/__tests__/agentmail.test.ts`
- Mock fetch, vérifier headers, payload, error handling

### 2.3 Script de validation end-to-end (obligatoire)
**Fichier** : `scripts/test-agentmail.ts`

Tests unitaires avec mock fetch ne prouvent pas que l'API AgentMail réelle répond. Script CLI qui :
- Lit `AGENTMAIL_API_KEY` + `AGENTMAIL_INBOX_ID` de `.env.local`
- Envoie un vrai email de test à `NOTIFY_EMAIL`
- Affiche la réponse (success / error)
- Permet de valider les creds + l'endpoint en 1 commande : `npx tsx scripts/test-agentmail.ts`

Sans ce script, on livre du code mort qu'on ne saura pas si il marche.

### 2.4 Wirer dans browser-apply (reporté, décision séparée)
**Question ouverte** : est-ce que browser-apply doit envoyer un vrai email AgentMail après remplir le formulaire ?

→ **Décidé séparément** une fois le client testé via 2.3. Pas dans ce plan.

### Commits Phase 2
1. `feat(api): add AgentMail client with tests`
2. `chore(scripts): add agentmail e2e validation script`

### Rollback Phase 2
- Retirer le client `agentmail.ts` + script `test-agentmail.ts` (aucun caller en prod tant que 2.4 n'est pas fait).

---

## Phase 3 — Observabilité (Sentry)

### 3.1 Setup Sentry Next.js
- `npm install @sentry/nextjs`
- `npx @sentry/wizard@latest -i nextjs` (génère sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts)
- Compte Sentry gratuit (5k events/mois suffisent largement pour ton volume)
- Ajouter `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` à `.env.example` et `.env.local`

### 3.2 Instrumenter les crons
Dans chaque cron route (`fetch-jobs`, `notifications`, `expire-jobs`), wrapper le try/catch global :
```ts
import * as Sentry from "@sentry/nextjs";
// ...
} catch (error) {
  Sentry.captureException(error, { tags: { cron: "fetch-jobs" } });
  // ... existing logging
}
```

Et dans les catch par-profil :
```ts
Sentry.captureException(profileError, {
  tags: { cron: "fetch-jobs", profileId: profile.id },
});
```

### 3.3 Centraliser le capture Sentry dans le helper `sendEmail`
**Éviter doubles events** : Phase 1.1 fait `throw` sur `!result.success`, et le catch par-profil en 3.2 capture déjà. Si on ajoute aussi un `captureMessage` au call-site, on aura 2 events Sentry pour la même erreur.

**Choix retenu** : ajouter `Sentry.captureMessage` directement dans le helper `sendEmail` (fichier `src/lib/services/email-service.ts`) quand `!result.success` avant de retourner. Comme ça :
- 1 seul event Sentry par échec (centralisé dans le helper)
- Le throw au call-site reste pour faire remonter dans le summary du cron
- Tags : `{ service: "email" }` + le subject ou un identifiant non-sensible

**Ne PAS** ajouter `captureMessage` au call-site dans les crons.

### 3.4 Health endpoint étendu
[src/app/api/health/route.ts] actuel teste seulement la DB. L'étendre pour retourner :
- `lastCronRun.fetchJobs` (lire depuis Supabase une nouvelle table `cron_runs` ou metadata profile)
- `lastCronRun.notifications`
- `lastEmailSent` (timestamp + success/fail)

**Décision** : créer une mini-table `cron_runs` (Sentry capture les erreurs, mais on veut un health endpoint qui répond sans appel API externe pour savoir si le cron a bien tourné).

**Migration** : `supabase/migrations/011_cron_runs.sql`

```sql
create table if not exists cron_runs (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  ran_at timestamptz not null default now(),
  success boolean not null,
  duration_ms integer,
  error_message text,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_cron_runs_route_ran_at
  on cron_runs (route, ran_at desc);

-- Cleanup auto : keep 30 jours d'historique
-- (à appeler depuis un cron mensuel, pas critique pour Phase 3)
```

À chaque fin de cron : insert avec `route`, `success`, `duration_ms`, `error_message` si applicable, `metadata` (ex: `{ emailsSent, emailsFailed, jobsFetched }`).

### Commits Phase 3
1. `chore: setup Sentry for error tracking`
2. `feat(cron): instrument all crons with Sentry`
3. `feat(db): cron_runs table + migration 011`
4. `feat(cron): persist run results to cron_runs table`
5. `feat(api): health endpoint reports cron status`

### Rollback Phase 3
- **Sentry** : retirer `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` de Vercel env vars. Les SDK no-op sans DSN, aucun changement code requis.
- **Table cron_runs** : `drop table cron_runs;` + retirer les inserts dans les crons (4 endroits max).

---

## Phase 4 — Qualité résultats (Tavily/Firecrawl)

### 4.1 Filtre URL anti-listing dans deduplicator
**Fichier** : `src/lib/services/deduplicator.ts`

**⚠️ Risque faux positifs** : `/search` ou `/browse` trop larges → match sur `https://emploi.example.com/search/job/12345` (URL d'offre légitime). Resserrer les regex pour matcher **uniquement les pages de listing** :

```ts
const LISTING_URL_PATTERNS = [
  /\/recherche-emploi\/?(\?|$)/,        // Jobillico listing
  /\/recherche-emploi\/[^/]+\/[^/]+\/?(\?|$)/, // Jobillico catégorie/ville
  /\/search\/?(\?|$)/,                  // ancre stricte fin URL
  /\/browse\/?(\?|$)/,
  /\/jobs?\/category\//,
  /\/job-search\/?(\?|$)/,
  /\/emplois?\/?(\?|$)/,                // Jobboom listing
];

function isListingPage(url: string): boolean {
  try {
    const u = new URL(url);
    return LISTING_URL_PATTERNS.some((rx) => rx.test(u.pathname + u.search));
  } catch {
    return false;
  }
}
```

**Validation obligatoire avant merge** : tester sur **≥5 URLs réelles positives et négatives** :

Positifs (à rejeter) :
- `https://www.jobillico.com/recherche-emploi/commis-d-entrepot/quebec/`
- `https://www.jobboom.com/emplois/`
- (à compléter avec des exemples vus dans les logs Tavily)

Négatifs (à garder) :
- `https://www.jobillico.com/emploi/12345-commis-entrepot-XYZ`
- `https://emploi.example.com/search/job/12345` (sous-chemin avec ID)
- (à compléter avec des URLs d'offres connues)

Écrire un test unitaire `deduplicator.test.ts` avec ces URLs avant de déployer.

Rejeter ces jobs avant le scoring (économise les appels OpenAI).

### 4.2 Bonus (M1) — Compléter `SOURCE_PRIORITY`
**Fichier** : `src/lib/services/deduplicator.ts:3-8`

Le map `SOURCE_PRIORITY` ne contient ni `jsearch` ni `tavily` → ces sources tombent à `score = 0` et sont systématiquement déclassées par Adzuna/Firecrawl en cas de doublon. Ajouter explicitement (ordre à valider selon qualité observée) :

```ts
const SOURCE_PRIORITY: Record<string, number> = {
  firecrawl: 4,
  jsearch: 3,
  adzuna: 2,
  tavily: 1,
  // ... ajuster selon retour terrain
};
```

Hors scope initial, mais à corriger pendant qu'on est dans le fichier.

### 4.2 Recharger crédits Firecrawl cloud
**Décision** : on garde la version Web Firecrawl. Quand crédits insuffisants, recharger via dashboard. Pas de self-host pour l'instant (revoir si quota cramé trop vite).

### 4.3 Ajouter Firecrawl au cron quotidien (optionnel)
Pour l'instant Firecrawl n'est que dans Scout mode. À évaluer : est-ce qu'on ajoute `firecrawl` à `sources: ["jsearch", "adzuna", "tavily", "firecrawl"]` dans le cron, ou on garde Firecrawl exclusif au Scout mode pour économiser les crédits ?

→ **Recommandation** : garder Firecrawl en Scout mode seulement (cron tourne 1×/jour, Firecrawl coûte cher en crédits par appel). Tavily + le filtre listing devrait suffire pour le cron quotidien.

### Commits Phase 4
1. `feat(deduplicator): filter out listing/category page URLs`
2. `fix(deduplicator): include jsearch and tavily in SOURCE_PRIORITY`
3. (manuel) recharger crédits Firecrawl quand nécessaire

### Rollback Phase 4
- Retirer le filtre URL : revert du commit. Les jobs listing reviendront mais aucun risque structurel.

---

## Phase 5 — SMS Canada (reporté)
Décision déjà prise : on traite plus tard. Pas dans ce plan.

---

## Tests / validation

### Avant chaque commit
- `npm run lint` + `npm run type-check`
- Tests unitaires sur fichiers modifiés

### Validation end-to-end Phase 1
1. Trigger manuel du cron fetch-jobs en local avec un mock sendEmail qui retourne `{success: false}` → vérifier que l'erreur remonte
2. Curl manuel sur `/api/cowork/notify` avec un mauvais payload → vérifier que la 400 contient le diagnostic

### Validation end-to-end Phase 3
1. Forcer une erreur dans un cron → vérifier qu'elle apparaît dans le dashboard Sentry
2. Curl `/api/health` → vérifier que les champs cron_runs sont présents

---

## Checkpoints (Senior Review Gate à la fin de chaque phase)

- **Fin Phase 1** : review obligatoire (impact prod critique)
- **Fin Phase 2** : review du client AgentMail (Context7-first respecté ?)
- **Fin Phase 3** : skipable si Sentry montre déjà des events
- **Fin Phase 4** : review du filtre listing (regex testées sur vraies URLs Jobillico/Jobboom)

---

## Out of scope

- Migration Firecrawl OSS (décision : reporté)
- SMS canal (décision : reporté)
- Refactor du scout externe (pas dans ce repo)
- Audit des autres routes Zod identifiées (scout, fetch-and-score, browser-apply, jobs/dismiss, jobs/search) — à faire en phase séparée si besoin, **pas urgent** parce qu'aucune n'est appelée par un caller qui se trompe actuellement

---

## Estimation totale
- Phase 1 : 1-2h
- Phase 2 : 4-6h (doc AgentMail peu mature, prévoir fallback + script de test)
- Phase 3 : 2-3h (Sentry wizard fait beaucoup)
- Phase 4 : 1-2h (inclut tests regex sur URLs réelles)
- **Total : 8-13h sur 2-3 sessions**

---

## Changelog du plan
- **v1** (2026-05-20) : version initiale
- **v2** (2026-05-20) : révisions après code review independent (superpowers:code-reviewer)
  - Phase 1.1 : préciser inversion ordre `emailsSent++`, ajouter `emailsFailed` + HTTP 500
  - Phase 1.2 : whitelist explicite `zod_issues` (path/code/message), pas `received` ; bonus helper `zodErrorResponse`
  - Phase 2 : ajout sous-tâche 2.3 script validation e2e obligatoire
  - Phase 3.3 : centraliser Sentry dans helper `sendEmail` (pas au call-site) pour éviter doubles events
  - Phase 3.4 : DDL `cron_runs` écrit explicitement + nom migration 011
  - Phase 4.1 : regex resserrées + liste URLs cibles à tester avant merge
  - Phase 4.2 : ajout fix `SOURCE_PRIORITY` (jsearch + tavily manquants)
  - Rollback explicite par phase
