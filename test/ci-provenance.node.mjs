import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), 'utf8');
const ci = read('.github/workflows/ci.yml');
const readiness = read('docs/PRELAUNCH_READINESS.md');

test('CI uses least privilege, cancellation, and immutable action revisions', () => {
  assert.match(ci, /^permissions:\n  contents: read$/m);
  assert.match(ci, /^concurrency:\n  group: ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n  cancel-in-progress: true$/m);

  for (const action of ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact']) {
    assert.match(
      ci,
      new RegExp(`uses: ${action}@[a-f0-9]{40}`),
      `${action} must be pinned to an immutable commit SHA`,
    );
  }
});

test('CI fails high or critical production dependency advisories but preserves audit evidence', () => {
  assert.match(ci, /npm audit --omit=dev --package-lock-only --audit-level=high/);
  assert.match(ci, /npm audit --package-lock-only --json/);
  assert.match(ci, /audit-reports/);
  assert.match(ci, /dependency-graph\.json/);
});

test('CI keeps browser automation out of remote workflows until the local Dev-only gate is complete', () => {
  assert.doesNotMatch(ci, /test:browser|browser-gate|docker compose/);
});

test('release workflow creates immutable-SHA provenance evidence without publishing', () => {
  const releasePath = new URL('.github/workflows/release.yml', root);
  assert.equal(existsSync(releasePath), true, 'release workflow must exist');
  const release = read('.github/workflows/release.yml');

  assert.match(release, /tags:\n\s+- 'v\*'/);
  assert.match(release, /github\.sha/);
  assert.match(release, /git show --show-signature/);
  assert.match(release, /sha256sum package-lock\.json/);
  assert.match(release, /npm audit --omit=dev --package-lock-only --audit-level=high/);
  assert.match(release, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.doesNotMatch(release, /gh release create|softprops\/action-gh-release|docker compose/);
});

test('pre-launch checklist leaves remote GitHub enforcement as an administrator action', () => {
  assert.match(readiness, /GitHub administrator action/i);
  assert.match(readiness, /branch protection|ruleset/i);
  assert.match(readiness, /not enabled by this repository change/i);
});
