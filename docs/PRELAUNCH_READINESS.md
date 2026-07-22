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
| 1 | Complete | Auth recovery and public notification privacy boundaries | `ad7493c harden auth recovery and notification scope`; final review approved; full gate passed (251 UI + 205 Node); Dev healthy |
| 2 | Complete | Authenticated live sync, proxy trust, and canonical public URLs | `8f5dd88`, `c1cec9b`; topology remains subject to deployment review |
| 3 | Complete (local scope) | Verified local backup/restore, provenance-safe retention, and credential-free off-host hook | `ecb550c`; off-host provider, keys, scheduler, and operator drill are explicitly deferred operational decisions |
| 4 | Complete | Complete data export/import/clear contract and strict persisted-state validation | `66b5cba`, `602a86d` |
| 5 | Complete | Browser/mobile regression gate; rhythm modal structural mobile redesign | Isolated ephemeral loopback-only browser target passed Playwright on mobile 375×812 and desktop 1440×900; strict fixture state and full local gate passed. |
| 6 | Deferred | Growth-reference correctness, accessibility foundation, startup/error states | Growth correction requires the authoritative WHO-vs-CDC standard decision; remaining product/accessibility work is out of this wrap-up scope. |
| 7 | Complete (repository scope) | CI/release hardening and dependency-audit/provenance foundation | `38cd065`; remote GitHub governance, CI execution, tag, and release actions remain external |

## CI / release provenance handoff (LAUNCH-01 / SUPPLY-01)

This repository change adds local workflow definitions and evidence collection only. It does **not** push a branch or tag, enable GitHub settings, publish a release, deploy an image, or modify production.

1. Finish the full local gate on the selected candidate commit and record its exact full SHA.
2. Create a signed annotated release tag (for example `git tag -s -a vX.Y.Z <SHA>`); review the tag target and signature before pushing.
3. After explicit publication approval, push the reviewed branch and tag separately.
4. Require successful remote CI for the **exact release commit**, not merely the branch tip: `gh run list --commit <SHA>` and inspect the matching workflow results.
5. Verify the remote tag resolves to the reviewed object: `git ls-remote origin refs/tags/vX.Y.Z`; download the CI release-provenance artifact and compare its commit and `package-lock.sha256` evidence to the reviewed candidate.
6. Create or publish a GitHub Release only after independent approval and the above checks. The included release workflow intentionally creates evidence only; it has no release-publishing or deployment step.

### Required GitHub administrator actions (not enabled by this repository change)

A repository administrator must separately configure and verify branch protection or a ruleset for the release branch: require the CI checks, restrict direct pushes/force pushes, and require review as appropriate for the repository. The administrator must also decide whether to enable Dependabot alerts/updates, secret scanning and push protection, and any environment protections/secrets. These remote settings are **not enabled by this repository change** and must not be represented as complete until GitHub settings are read back and verified.

### Dependency audit policy

CI fails when `npm audit --omit=dev --package-lock-only --audit-level=high` detects a high or critical production-relevant advisory. CI also uploads the full audit JSON and dependency graph to report dev-only advisories intentionally without making those advisories a release-blocking production gate. SUPPLY-01 remains open until current advisories are reviewed and resolved or formally risk-accepted.

## P0 — public launch blockers

- [ ] **LAUNCH-01** Push an exact release SHA and require green remote CI.
- [x] **LAUNCH-02** Add real-browser viewport/visual acceptance tests and structurally fix mobile rhythm modal fit.
- [x] **SEC-01** Make direct-port/proxy trust/rate limiting topology-safe and HTTPS-only.
- [x] **SEC-02** Require canonical `PUBLIC_BASE_URL` for auth/invite links.
- [x] **SYNC-01** Provide authenticated tenant-scoped live sync.
- [x] **RECOVERY-01** Disable or fully rebuild the unsafe event-log replay mechanism.
- [ ] **RECOVERY-02** Add migration-safe recovery, bounded logs/backups, encrypted off-host copy, and tested restore.
- [x] **PRIVACY-01** Blocked process-global server channels for non-default households pending tenant-specific destinations/credentials.
- [x] **AUTH-RECOVERY-01** Delivered password-reset codes through SMTP with non-enumerating public responses.
- [x] **PRIVACY-02** Remove health data/PII from routine logs; handle recovery data as a protected artifact.

### RECOVERY-02 implementation record

- [x] Local verified SQLite backup and restore staging/pre-restore safeguards are covered by focused tests; retention is provenance-safe for private runtime-created artifacts and leaves manual/historical files untouched.
- [x] `BACKUP_ON_START=1` remains in production Compose as the current verified-local backup baseline; it is not a replacement for scheduled or off-host recovery.
- [ ] RECOVERY-02 remains a launch blocker: no off-host provider/account, encryption key custodians, production scheduler, real encrypted upload, or isolated operator restore drill has been selected or exercised. No production access occurred.

## P1 — correctness and trust

- [x] **DATA-01** Versioned complete export/import/clear behavior with round-trip tests.
- [x] **DATA-02** Strict versioned domain validation before server persistence.
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

## Phase 2 — current implementation batch

### Confirmed discovery

- Native browser `EventSource` cannot attach the bearer token, so authenticated deployments receive `401` from `/api/state/events` and live sync stops after six failures.
- Text/email login and invite links fall back to request `Host` when `PUBLIC_BASE_URL` is empty.
- Production Compose exposes Node directly on `8080` while defaulting `TRUST_PROXY=1`, allowing direct clients to influence `req.ip` through forwarded headers.

### Planned vertical slices

1. Require a canonical HTTPS `PUBLIC_BASE_URL` for authentication-link and invite delivery; remove the request-host fallback.
2. Change Compose/security defaults so direct Node exposure does not trust forwarded client headers.
3. Replace native authenticated EventSource with an authorization-capable stream mechanism and test two scoped authenticated clients.

### Implementation outcome

- [x] Canonical public origin and direct-port/proxy configuration were hardened in `8f5dd88`.
- [x] Authenticated tenant-scoped live state stream was implemented and regression-tested in `c1cec9b`.
- [x] Production remains untouched; actual proxy/load-balancer deployment topology must still be verified by its operator before public launch.

## Phase 1 implementation record

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
- [x] Phase 1 committed as `ad7493c`.

## Completed commits

- `38cd065 harden CI release provenance and audit gates` — adds repository-local CI and tag-triggered release-provenance evidence workflows, production dependency-audit gating, and documentation. Remote CI, branch governance, push, tag, and release publication are intentionally not performed here.
- `ecb550c harden verified backup and restore recovery` — retires unsafe event-log replay; adds verified local backup/restore safeguards, retention hardening, protected-artifact handling, and focused recovery/privacy coverage.
- `602a86d validate persisted tracker state strictly` — validates versioned persisted tracker state before server persistence.
- `66b5cba complete local tracker data export` — adds versioned full export/import/clear behavior and round-trip coverage.
- `c1cec9b restore authenticated live state sync` — provides authenticated, household-scoped live state synchronization.
- `8f5dd88 require canonical public auth origin` — requires canonical public auth/invite origin and hardens proxy/direct-port configuration.
- `add isolated browser launch gate` — `LAUNCH-02` Dev-only isolated Playwright acceptance gate covers 375×812 and 1440×900 DayRibbon interaction, selection, focus return, and viewport bounds. Browser Compose binds only `127.0.0.1:8081`, stores data in `tmpfs`, disables auth-required runtime and notifications, and never touches Dev/production state. The strict-state fixture deliberately omits empty optional `diaperKinds`, which strict persistence correctly rejects. Mobile modal sizing is border-box and no longer translates a full-height sheet below the viewport during opening animation. Validation: Playwright **4 passed**; lint passed; UI **261 passed**; Node **218 passed**; production build passed (existing bundle-size warning); `git diff --check` passed. Dev was restored healthy after isolated validation.
- `ad7493c harden auth recovery and notification scope` — Phase 1 implementation and regression tests.

## Merge-readiness validation record (2026-07-22)

- [x] Repository-local full gate passed: `npm run lint`; `npm test` (**261 UI + 218 Node tests passed**); `npm run build` (existing bundle-size warning only); and `git diff --check`.
- [x] All production, Dev, and browser Compose definitions parse with `docker compose ... config -q`.
- [x] The Dev-only isolated browser target passed `BROWSER_BASE_URL=http://127.0.0.1:8081 npx playwright test` (**4 passed**) after temporarily stopping and then restoring the pre-existing Dev container. The target used loopback, `tmpfs`, unauthenticated local-only mode, and disabled notifications; production was not accessed.
- [x] Branch audit found no tracked runtime database, backup, log, build, test-report, environment, or other private-data artifact. `.gitignore` covers those local artifact classes.

## Decisions / open concerns

- **No silent cross-tenant notification fallback:** Until per-household encrypted delivery destinations exist, only the default household may use the existing global Gotify/text-email adapters.
- **NOTIFY destination credential custody is a hard security decision (2026-07-22):** Discovery confirmed that notification transport credentials are process-global environment values (`GOTIFY_URL`/`GOTIFY_TOKEN` and SMTP credentials), while household settings are plain SQLite JSON. Implementing editable per-household destinations now would either put provider credentials in plaintext SQLite or require selecting and provisioning a key-management/custodian design. Neither an encryption root/key custodian nor a supported notification provider/destination contract has been supplied. The current fail-closed scheduler guard (`canDeliverForHousehold: householdId => householdId === DEFAULT_HOUSEHOLD_ID`) remains intact; no non-default household can use global recipients or tokens. Required decision: designate the provider(s), allowed destination types, and encryption-root/key-custodian lifecycle (provisioning, rotation, loss/recovery, and operator access) before this slice can safely proceed.
- **Password reset transport:** Direct auth email uses SMTP independently of `TEXT_EMAIL_TO`; text-login and reminder delivery remain recipient-gated. Missing SMTP is a deployment-wide `503`. For a configured adapter, delivery failures return the same public success shape as unknown accounts to prevent enumeration, while logging the failure internally and persisting no code.
- **Automation cadence:** The five-minute readiness autopilot is intentionally paused at user request. Resume only with explicit user direction; continue manual Dev-only work from this tracker in the meantime.
- **Growth standard:** Sex/reference-specific percentile correctness remains deferred until the product owner designates the authoritative WHO-versus-CDC standard, its age ranges, and source/version. Do not infer this from implementation convenience.
- **Off-host recovery:** An off-host encrypted backup provider/account, encryption-key custody and rotation/recovery process, scheduler, and isolated operator restore drill have not been selected. Local verified recovery is implemented, but this external operating decision remains a public-launch blocker.
- **Remote release governance:** GitHub branch protection/rulesets, required remote CI, signing/push/tag/release workflow, and administrator verification remain external actions. The repository contains only the local workflow and evidence foundation.
- **Production promotion:** Explicit user approval and a separate backup-first procedure are still required.
