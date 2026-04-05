# JobPilot Agent Orchestration Guide

> System context for the agent (OpenClaw/Claude Cowork) when piloting JobPilot.
> This document describes decision logic, available endpoints, and operational rules.

---

## Daily Cycle (UTC)

| Time | Cron | Action |
|------|------|--------|
| 2:00 AM | expire-jobs | Expire stale jobs (3d processed, 7d unseen, 30d absolute). Jobs with active applications are protected. |
| 4:00 AM | fetch-jobs | Fetch from JSearch + Adzuna + Firecrawl, deduplicate, upsert, auto-score, mark seen, send email alerts. |
| 4:30 AM | notifications | Email digest of new high-score matches. |
| On-demand | agent | Call `/api/cowork/next-actions` to decide what to do next. |
| On-demand | scout | Call `/api/cowork/scout` for proactive job discovery on career pages, Jobillico, etc. |

---

## Cowork API Surface

### GET /api/cowork/next-actions

Returns prioritized actions the agent should take. Call this first.

**Response:** `{ actions: Action[], context: DashboardContext, generatedAt: string }`

**Action types (by priority):**
1. `fetch_jobs` (HIGH) — pipeline needs fresh data (unseen < 10 or no recent jobs)
2. `apply_high_match` (HIGH) — jobs with score >= 75, includes payload for browser-apply
3. `review_stale` (MEDIUM) — applications stuck 7+ days in applied/interview
4. `notify_matches` (LOW) — send email digest
5. `idle` (LOW) — nothing to do

### POST /api/cowork/fetch-and-score

Fetches and scores jobs. Uses profile's search_preferences by default.

**Optional body:** `{ keywords?, location?, sources?: ["jsearch"|"adzuna"|"firecrawl"] }`

**Response:** `{ fetched, inserted, scored, topMatches[], errors[] }`

### POST /api/cowork/browser-apply

**3-phase workflow:**

**Body:** `{ job_listing_id: UUID, application_url: URL, resume_id?: UUID }`

**Phase 1 — Reconnaissance:** Scrapes the application URL with Firecrawl, classifies ATS type (linkedin, indeed, workday, greenhouse, lever, other), detects form fields and auth requirements.

**Phase 2 — Decision:**
- Auto-apply: Greenhouse, Lever, or "other" with simple form and no auth
- Escalate to `needs_review`: LinkedIn, Indeed, Workday, or any page requiring auth

**Phase 3 — Execution:** Uses `firecrawl interact` to fill form fields with profile data (name, AgentMail email) and submit.

**AgentMail:** Applications use `jobpilot-aziz@agentmail.to` as the contact email. Confirmations arrive there, not in the personal inbox. The agent can check this inbox via AgentMail MCP tools.

**Response:** `{ status, phase, applicationId, atsType?, reason?, error?, message? }`

**Status values:** `submitted` | `needs_review` | `failed`

### GET /api/cowork/stale-applications

Returns applications unchanged for N days (default 7) in applied/interview status.

**Query:** `?days=7` — basic stale list
**Query:** `?days=7&check_urls=true` — also verifies if job postings are still active via Firecrawl (max 5 URLs per call). Closed postings are auto-marked `needs_review`.

### POST /api/cowork/scout

**3 modes for proactive job discovery beyond the standard pipeline.**

**Mode "targets"** — Scrape specific career pages:
```json
{ "mode": "targets", "urls": ["https://carrieres.stm.info/offres", "https://www.jobillico.com/recherche-emploi/montreal/quebec/temps-plein"] }
```

**Mode "search"** — Web search with structured extraction:
```json
{ "mode": "search", "keywords": "emploi temps plein 21$ heure", "location": "Montreal", "limit": 10 }
```

**Mode "agent"** — Autonomous navigation for complex sites:
```json
{ "mode": "agent", "prompt": "Find all open positions at City of Montreal paying $20-25/hour", "maxCredits": 50 }
```

**Response:** `{ mode, discovered, inserted, scored, topMatches[], errors[], creditsUsed }`

**When to use each mode:**
- `targets`: daily cron on known career pages (STM, Ville de Montreal, Desjardins, universities)
- `search`: when looking for new types of jobs or exploring new keywords
- `agent`: for complex career sites with pagination, filters, or dynamic content (use sparingly — higher credit cost)

**Credit budget:** Set `maxCredits` in agent mode to cap spending. Targets mode costs ~3-5 credits/URL, search ~5/result, agent ~10-50 per mission.

---

### GET /api/cowork/dashboard-summary

Aggregated pipeline state: active jobs, unseen count, application status distribution, recent job counts.

### POST /api/cowork/notify

Send email notifications. Body: `{ type: "new_matches"|"stale_reminder", ... }`

---

## Agent Decision Rules

### When to fetch
- `unseenJobCount < 10` or `recentJobsFetched24h === 0`
- OR explicitly requested by user
- Default sources: all three (JSearch, Adzuna, Firecrawl)

### When to apply
- Job has `overall_score >= 75` from match_scores
- Job has a valid `source_url`
- No existing application for this job
- Call browser-apply with the job's source_url

### How to handle browser-apply results
| Status | Agent action |
|--------|-------------|
| `submitted` | Log success, move to next job |
| `needs_review` | Note the atsType and reason, flag for human review |
| `failed` (recon) | Log error, skip this job, try next |
| `failed` (execution) | Log error, consider retry once, then skip |

### When to escalate to human
- `agent_status = "needs_review"` — agent cannot automate this application
- 3+ consecutive failures on different jobs — possible systemic issue
- Firecrawl credits running low (check response headers if available)

---

## Database Columns for Agent Coordination

### applications table

| Column | Values | Meaning |
|--------|--------|---------|
| `status` | saved, applying, applied, interview, offer, accepted, rejected, withdrawn | User-visible pipeline status |
| `agent_status` | pending, ready, submitted, failed, needs_review | Agent workflow state (independent of user status) |
| `ats_type` | linkedin, indeed, workday, greenhouse, lever, other | Application system type — informs how to apply |
| `agent_notes` | free text | Error messages, recon results, submission details |
| `application_method` | browser, api, manual | How the application was submitted |

### Lifecycle flow

```
next-actions returns apply_high_match
  -> agent calls browser-apply
    -> Phase 1: recon -> ats_type set, agent_status = "pending"
    -> Phase 2: decision
      -> canAutomate=true -> Phase 3: execution
        -> success -> agent_status = "submitted", status = "applied"
        -> failure -> agent_status = "failed"
      -> canAutomate=false -> agent_status = "needs_review"
```

---

## Job Sources

| Source | Type | Quota | Best for |
|--------|------|-------|----------|
| JSearch | API (RapidAPI) | 500 req/month | Structured search, international coverage |
| Adzuna | API | 2500 req/month | Canadian market, salary data |
| Firecrawl | Web scraping | Credits-based | Any website, Quebec boards, employer pages |

### Firecrawl credit management
- Search+extract: ~1 credit per result
- Browser session (interact): ~2 credits/minute
- Typical application attempt: 3-5 credits (scrape + interact)
- Monitor usage; prefer JSearch/Adzuna for standard searches, reserve Firecrawl for sources they don't cover

---

## Error Codes

API routes use `apiError()` which returns structured errors with known codes:

| Code | Meaning | Agent action |
|------|---------|-------------|
| `VALIDATION_ERROR` | Bad request body | Fix payload and retry |
| `RESUME_NOT_FOUND` | No resume for scoring | Upload resume first |
| `INTERNAL_ERROR` | Server error | Log and retry once |
| 401 | Missing/bad CRON_SECRET | Check auth header |
| 404 | Resource not found | Skip this item |

---

## Authentication

All cowork endpoints require the `CRON_SECRET` header:

```
Authorization: Bearer <CRON_SECRET>
```

Or as query parameter: `?secret=<CRON_SECRET>`

Verified via `verifyCronSecret()` from `@/lib/api/cron-auth`.
