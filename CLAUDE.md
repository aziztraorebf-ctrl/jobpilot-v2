# JobPilot - Instructions Projet

## Context
- Lire `docs/compact_current.md` en debut de session pour l'etat actuel
- Lire `docs/compact_master.md` pour les decisions architecturales et la stack

## Project Conventions
- Sub-agents ne commitent pas - seul l'orchestrateur (agent principal) fait les commits
- Templates email : beaux, responsifs, detailles mais pas complexes
- Mode 100% automatise : l'architecture priorise le flux continu de nouvelles offres
- Queries DB : utiliser les RPC Postgres (migration 009) au lieu de NOT IN string concat
- Auth cron : toujours utiliser `verifyCronSecret()` de `@/lib/api/cron-auth`
- Error responses : utiliser `apiError()` de `@/lib/api/error-response` (inclut codes specifiques)

## Guardrails
- Verifier visuellement avec Playwright AVANT de corriger des problemes UI
- Jobs avec candidature active (saved/applying/applied/interview/offer) ne doivent JAMAIS etre expires
- Ne pas reintroduire de blocage inbox_limit dans le cron fetch-jobs
