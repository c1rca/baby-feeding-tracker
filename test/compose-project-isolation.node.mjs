import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const composeName = async (file) => {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  return source.match(/^name:\s*(\S+)$/m)?.[1]
}

test('production, Dev, and browser acceptance Compose stacks have distinct fixed project names', async () => {
  const names = await Promise.all(['docker-compose.yml', 'docker-compose.dev.yml', 'docker-compose.browser.yml'].map(composeName))
  assert.deepEqual(names, ['bft-prod', 'bft-dev', 'bft-browser-acceptance'])
})

test('the browser acceptance Compose target uses the port its guarded helpers allow', async () => {
  const source = await readFile(new URL('../docker-compose.browser.yml', import.meta.url), 'utf8')
  assert.match(source, /127\.0\.0\.1:8082:8080/)
})
