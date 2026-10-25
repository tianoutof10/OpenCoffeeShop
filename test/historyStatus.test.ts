import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { historyStatus } from '../src/features/insights/historyStatus.ts'

test('cached history stays quiet during normal loads and background refreshes', () => {
  assert.equal(historyStatus(true, false), null)
  assert.equal(historyStatus(true, false, false), 'Limited history · cached records')
})

test('first load and unavailable history retain useful feedback', () => {
  assert.equal(historyStatus(false, false), 'Loading history…')
  assert.match(historyStatus(false, true)!, /History unavailable/)
  assert.match(historyStatus(true, true)!, /Showing saved history/)
})

test('history surfaces do not announce routine syncs or timestamp changes', () => {
  for (const name of ['InsightsHome', 'InsightsScreen']) {
    const source = readFileSync(new URL(`../src/features/insights/${name}.tsx`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /Syncing history|Last synced|Refreshing…/)
  }
})
