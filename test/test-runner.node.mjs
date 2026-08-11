import test from 'node:test'
import assert from 'node:assert/strict'
import { selectTestCommand } from '../scripts/test.mjs'

test('selectTestCommand routes a UI file argument to Vitest only', () => {
  assert.deepEqual(selectTestCommand(['src/app-stats-and-medicine.test.tsx']), ['npx', ['vitest', 'run', 'src/app-stats-and-medicine.test.tsx']])
})

test('selectTestCommand routes a node test file argument to node test only', () => {
  assert.deepEqual(selectTestCommand(['test/state-merge-session.node.mjs']), ['node', ['--test', 'test/state-merge-session.node.mjs']])
})
