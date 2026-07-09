# Auth + Multi-Baby Production Enablement Checklist

> **Branch:** `feature/prod-foundation-auth-households`
> **Purpose:** checklist for a future, explicit production promotion.
> **Do not run this accidentally:** this document describes production actions, but this branch work must not touch the production container or production DB unless the user explicitly asks.

## Table of Contents

1. [Current Safety Status](#current-safety-status)
2. [What This Branch Adds](#what-this-branch-adds)
3. [Required Environment](#required-environment)
4. [Pre-Promotion Validation](#pre-promotion-validation)
5. [Promotion Checklist](#promotion-checklist)
6. [Post-Promotion Verification](#post-promotion-verification)
7. [Rollback Notes](#rollback-notes)
8. [Known Follow-Ups](#known-follow-ups)

## Current Safety Status

- Production remains on `main` until the user explicitly asks for promotion.
- Do **not** run production rebuilds, restarts, migrations, backup scripts, DB reads/writes, or deploys from normal feature-branch work.
- Permitted during feature work: read-only container status checks such as:

```bash
docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.State.Status}} {{.State.Health.Status}}' baby-feeding-tracker 2>/dev/null || true
```

## What This Branch Adds

- Optional auth gate controlled by `AUTH_REQUIRED=1`.
- One-time default caregiver password bootstrap via `AUTH_BOOTSTRAP_PASSWORD`.
- Hashed passwords and hashed bearer sessions.
- Login, session identity, and logout routes.
- Household, user, session, baby, and per-baby state schema.
- Household-scoped baby list/create/archive APIs.
- `X-Baby-Id` selected-baby request scope.
- Viewer read-only API role enforcement.
- Frontend login gate, selected baby switcher, and baby create/archive controls.
- Public `/api/health` reduced to minimal readiness; authenticated `/api/diagnostics` holds details.

## Required Environment

Add only during an explicit promotion window:

```env
AUTH_REQUIRED=1
AUTH_BOOTSTRAP_PASSWORD=<strong one-time bootstrap password>
```

Existing production values should remain:

```env
PORT=8080
DB_DIR=/data
DB_PATH=/data/feeding-tracker.db
BACKUP_ON_START=1
BACKUP_DIR=/backups
LOG_DIR=/logs
NOTIFICATIONS_ENABLED=1
FEEDING_TIME_ZONE=America/New_York
TZ=America/New_York
```

Notification secret files stay external and must not be committed:

```text
.env.gotify
.env.smtp
```

Security notes:

- `AUTH_BOOTSTRAP_PASSWORD` sets the default caregiver password only if no password hash exists yet.
- After first successful authenticated login is verified, remove or rotate the bootstrap value from the runtime environment before future restarts.
- Current auth token storage is browser `localStorage` bearer-token based. If moving to cookies later, add CSRF protection first.
- If running behind a reverse proxy, decide and test `trust proxy` behavior before relying on IP-based rate limits.

## Pre-Promotion Validation

Run locally on the feature branch first:

```bash
npm run test:node
npm run build
npm run lint
npm test
```

Confirm branch and commit stack:

```bash
git status --short --branch
git log --oneline -12 --decorate
```

Confirm no secrets are staged:

```bash
git diff --cached --check
git status --short
```

## Promotion Checklist

Only run this section when the user explicitly says to promote/rebuild production.

1. Confirm exact target host/path/container with the user.
2. Confirm whether DB access/backups are allowed. If the user says not to touch DB, stop here and do code-only work.
3. Create a backup before changing runtime config or image:

```bash
npm run backup:db
```

4. Record current branch/commit and container state:

```bash
git status --short --branch
git rev-parse --short HEAD
docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.State.Status}} {{.State.Health.Status}}' baby-feeding-tracker
```

5. Apply auth environment settings in the deployment environment.
6. Rebuild/recreate only the intended service. Do **not** use `--remove-orphans` unless explicitly requested.
7. Verify health:

```bash
curl -fsS http://localhost:8080/api/health
```

8. Open UI and verify login screen appears.
9. Log in with the bootstrap password.
10. Verify existing feeds/timeline still load under the default baby.
11. Verify baby switcher/management controls if multiple babies exist.
12. Remove or rotate `AUTH_BOOTSTRAP_PASSWORD` after the default caregiver password is established.

## Post-Promotion Verification

Check container status and logs:

```bash
docker compose ps
docker compose logs --no-color --tail=120 feeding-tracker
curl -fsS http://localhost:8080/api/health
```

Authenticated checks from a browser session:

- login succeeds
- logout returns to login
- timeline data is present
- state writes persist after refresh
- baby create/archive works for caregiver/owner
- viewer cannot mutate if a viewer account exists
- notification settings still load

## Rollback Notes

Compatibility guardrails already in this branch:

- Legacy `app_state` remains present.
- Default baby scoped state is dual-written back to legacy `app_state` for rollback compatibility.
- Non-default baby state does not overwrite legacy `app_state`.
- Baby archive is soft-delete, not hard-delete.

Rollback options after an explicit promotion:

1. If only runtime auth config is problematic, unset `AUTH_REQUIRED` and restart the intended service.
2. If code rollback is needed, return to the known good production commit/branch and rebuild the intended service.
3. If data rollback is needed, restore the pre-promotion backup:

```bash
docker compose down
npm run restore:db -- backups/feeding-tracker-YYYYMMDD-HHMMSS.db
docker compose up -d
curl -fsS http://localhost:8080/api/health
```

## Known Follow-Ups

Before broad/public exposure:

- Add password/admin reset flow beyond one-time bootstrap.
- Decide reverse proxy + `trust proxy` behavior for rate limiting.
- Add CSRF protection before any cookie-based session migration.
- Audit scheduler/SSE/startup snapshot behavior for scoped-state assumptions.
- Add off-host encrypted backups and monitoring.
