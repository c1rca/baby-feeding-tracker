# Pre-Launch Readiness Tracker

> **Branch:** `feat/prelaunch-readiness`  
> **Rule:** Production is never rebuilt or restarted from this branch. Validate only with local commands and Dev Compose (`baby-tracker-dev`, port 8081).
> **How to resume:** Read this file and `git status --short --branch` before selecting the next unchecked phase. Update the status, validation evidence, and remaining work before each commit.

## Launch decision

- **Controlled single-household Dev/beta:** Continue hardening.
- **Public multi-household launch:** Blocked pending all P0 items below.

## Phase status

| Phase | Status | Scope | Evidence / commit |
|---|---|---|---|
| 0 | Complete | Establish branch, tracker, and validated baseline | `feat/prelaunch-readiness`; full lint/build/tests green |
| 1 | Complete | Auth recovery and public notification privacy boundaries | Final security/spec review approved; full gate passed (251 UI + 205 Node); Dev healthy; commit pending below |
| 2 | Pending | Authenticated live sync, proxy trust, and canonical public URLs | |
| 3 | Pending | Recovery safety, encrypted/off-host retention design, migration/restore hardening | |
| 4 | Pending | Complete data export/import/clear contract and strict persisted-state validation | |
| 5 | Pending | Browser/mobile regression gate; rhythm modal structural mobile redesign | |
| 6 | Pending | Growth-reference correctness, accessibility foundation, startup/error states | |
| 7 | Pending | CI/release hardening, dependency advisories, PWA, refactors, docs | |

## P0 — public launch blockers

- [ ] **LAUNCH-01** Push an exact release SHA and require green remote CI.
- [ ] **LAUNCH-02** Add real-browser viewport/visual acceptance tests and structurally fix mobile rhythm modal fit.
- [ ] **SEC-01** Make direct-port/proxy trust/rate limiting topology-safe and HTTPS-only.
- [ ] **SEC-02** Require canonical `PUBLIC_BASE_URL` for auth/invite links.
- [ ] **SYNC-01** Provide authenticated tenant-scoped live sync.
- [ ] **RECOVERY-01** Disable or fully rebuild the unsafe event-log replay mechanism.
- [ ] **RECOVERY-02** Add migration-safe recovery, bounded logs/backups, encrypted off-host copy, and tested restore.
- [x] **PRIVACY-01** Blocked process-global server channels for non-default households pending tenant-specific destinations/credentials.
- [x] **AUTH-RECOVERY-01** Delivered password-reset codes through SMTP with non-enumerating public responses.
- [ ] **PRIVACY-02** Remove health data/PII from routine logs; handle recovery data as a protected artifact.

## P1 — correctness and trust

- [ ] **DATA-01** Versioned complete export/import/clear behavior with round-trip tests.
- [ ] **DATA-02** Strict versioned domain validation before server persistence.
- [ ] **PRODUCT-01** Correct sex/reference-specific growth percentile behavior.
- [ ] **NOTIFY-01** Repair custom reminder interval flow.
- [ ] **NOTIFY-02** Scope all active scheduler notification comparisons.
- [ ] **AUTHZ-01** Server-enforce safe baby archive behavior.
- [ ] **A11Y-01** Standardize accessible dialogs.
- [ ] **PRODUCT-02** Replace/remove the no-op account creation CTA.
- [ ] **PRODUCT-03** Make pumping production behavior consistent with creation controls.
- [ ] **UX-STARTUP-01** Add explicit auth/baby load/error states.
- [ ] **QUALITY-01** Remove GrowthDashboard render-phase state update warning.
- [ ] **QUALITY-02** Lint/type-check backend code.
- [ ] **SUPPLY-01** Resolve advisories and enforce dependency auditing.
- [ ] **OPS-01** Add privacy-safe observability and operational alerts.
- [ ] **DOCS-01** Rewrite production/deployment/recovery documentation against current behavior.

## P2 — after trust boundaries

- [ ] Versioned migrations and repository/service boundaries.
- [ ] Settings/modal/CSS decomposition.
- [ ] Lazy loading and startup bundle budget.
- [ ] Household timezone, unit preferences, medicine dose data, caregiver attribution, pediatrician reports.
- [ ] PWA install/update/offline UX.

## Current implementation batch: Phase 1

### Goals

1. Deliver password-reset codes using the existing configured SMTP adapter, without exposing tokens to API callers.
2. Ensure failed password-reset delivery does not leave a durable unusable token.
3. Block server-channel notification delivery for non-default households until tenant-specific destinations and credentials exist.
4. Add direct regression coverage for both behaviors.

### Preconditions checked

- [x] New branch created from `main`: `feat/prelaunch-readiness`.
- [x] Working tree clean before edits.
- [x] Production excluded from this work.

### Validation completed for Phase 1

- [x] Focused Node auth, runtime-config, and notification tests.
- [x] Full Node suite: **205 passed**.
- [x] Full UI suite: **251 passed**; known `GrowthDashboard` render-phase warning remains tracked as `QUALITY-01`.
- [x] Lint and production build passed; pre-existing bundle-size warning remains tracked as `PERF-01`.
- [x] Dev Compose rebuilt and reached `healthy`; `GET :8081/api/health` returned `{"ok":true}`.
- [x] Production container start time verified unchanged: `2026-07-21T17:25:35.541931768Z`.
- [ ] Live SMTP delivery intentionally not triggered against a real recipient during Dev verification; adapter behavior is covered through injected route tests.
- [x] Final independent security/spec re-review approved.
- [ ] Commit Phase 1.

## Completed commits

_None yet._

## Decisions / open concerns

- **No silent cross-tenant notification fallback:** Until per-household encrypted delivery destinations exist, only the default household may use the existing global Gotify/text-email adapters.
- **Password reset transport:** Direct auth email uses SMTP independently of `TEXT_EMAIL_TO`; text-login and reminder delivery remain recipient-gated. Missing SMTP is a deployment-wide `503`. For a configured adapter, delivery failures return the same public success shape as unknown accounts to prevent enumeration, while logging the failure internally and persisting no code.
- **Production promotion:** Explicit user approval and a separate backup-first procedure are still required.
