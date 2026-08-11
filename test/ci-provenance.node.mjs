import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), 'utf8');
const ci = read('.github/workflows/ci.yml');

test('CI uses least privilege, cancellation, and immutable action revisions', () => {
  assert.match(ci, /^permissions:\n {2}contents: read$/m);
  assert.match(ci, /^concurrency:\n {2}group: ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: true$/m);

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

test('CI runs the disposable loopback browser acceptance gate and preserves failure evidence', () => {
  assert.match(ci, /^ {2}browser-acceptance:\n/m);
  assert.match(ci, /docker compose -p bft-browser-acceptance -f docker-compose\.browser\.yml up -d --build/);
  assert.match(ci, /BROWSER_BASE_URL=http:\/\/127\.0\.0\.1:8082 npx playwright test test\/browser\/acceptance-feed\.spec\.ts --grep "Start Left then Stop & Save"/);
  assert.match(ci, /BROWSER_BASE_URL=http:\/\/127\.0\.0\.1:8082 npx playwright test test\/browser\/acceptance-resilience\.spec\.ts --project=mobile-chromium --grep "feed entry: survives"/);
  assert.match(ci, /BROWSER_BASE_URL=http:\/\/127\.0\.0\.1:8082 npx playwright test test\/browser\/stats-density\.spec\.ts/);
  assert.match(ci, /docker compose -p bft-browser-acceptance -f docker-compose\.browser\.yml down/);
  assert.match(ci, /test-results\/browser-report/);
  assert.match(ci, /test-results\/browser-artifacts/);
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
