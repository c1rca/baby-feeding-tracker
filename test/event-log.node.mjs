import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createEventLogger } from '../server/eventLog.js'

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'event-log-'))
const mode = (file) => fs.statSync(file).mode & 0o777

test('event logger creates the file owner-only and appends records', () => {
  const dir = tempDir()
  const logPath = path.join(dir, 'nested', 'events.jsonl')
  const log = createEventLogger(logPath)
  log('sample_event', { userId: 'u1' })

  assert.equal(mode(logPath), 0o600)
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n')
  assert.equal(lines.length, 1)
  const record = JSON.parse(lines[0])
  assert.equal(record.event, 'sample_event')
  assert.equal(record.userId, 'u1')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('event logger tightens a pre-existing world-readable log file', () => {
  const dir = tempDir()
  const logPath = path.join(dir, 'events.jsonl')
  fs.writeFileSync(logPath, '', { mode: 0o644 })
  fs.chmodSync(logPath, 0o644)
  assert.equal(mode(logPath), 0o644)

  createEventLogger(logPath)
  assert.equal(mode(logPath), 0o600)
  fs.rmSync(dir, { recursive: true, force: true })
})
