import assert from 'node:assert/strict'
import test from 'node:test'
import { homeSettingValue } from '../src/features/settings/homeSettingValue.ts'

test('homescreen fallback preserves numbers and zero without inventing unavailable values', () => {
  const utility = { id: 'steam' as const, metrics: [
    { id: 'target' as const, value: '160' }, { id: 'flow' as const, value: '0.6' },
    { id: 'duration' as const, value: '0' }, { id: 'current' as const, value: '—' },
  ] }
  assert.equal(homeSettingValue(utility, 'target'), 160)
  assert.equal(homeSettingValue(utility, 'flow'), 0.6)
  assert.equal(homeSettingValue(utility, 'duration'), 0)
  assert.equal(homeSettingValue(utility, 'current'), undefined)
  assert.equal(homeSettingValue(utility, 'volume'), undefined)
  assert.equal(homeSettingValue(undefined, 'target'), undefined)
})
