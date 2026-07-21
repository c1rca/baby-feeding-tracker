import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRuntimeConfig } from '../server/runtimeConfig.js'
import * as startup from '../server/startup.js'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const localConfig = () => createRuntimeConfig({
  rootDir,
  env: { ALLOW_INSECURE_LOCAL_MODE: '1' },
})

test('runtime does not create or configure a JSONL health event log', () => {
  assert.equal(fs.existsSync(path.join(rootDir, 'server', 'eventLog.js')), false)
  const config = localConfig()
  assert.equal(Object.hasOwn(config, 'logDir'), false)
  assert.equal(Object.hasOwn(config, 'eventLogPath'), false)
})

test('historical health logs remain ignored by Git even after runtime logging is retired', () => {
  const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8')
  assert.match(gitignore, /^logs\/$/m)
  assert.match(gitignore, /^\*\.jsonl$/m)
})

test('startup module does not export a full-state snapshot producer', () => {
  assert.equal(Object.hasOwn(startup, 'appendStartupStateSnapshot'), false)
})
