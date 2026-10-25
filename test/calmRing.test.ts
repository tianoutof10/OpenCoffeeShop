import assert from 'node:assert/strict'
import test from 'node:test'
import { calmRingProgress } from '../src/features/brew/calmRing.ts'

test('the calm ring follows yield against target and never overflows', () => {
  assert.equal(calmRingProgress(18, 36, 10_000), 0.5)
  assert.equal(calmRingProgress(40, 36, 30_000), 1)
  assert.equal(calmRingProgress(undefined, 36, 5_000), 0)
})

test('without a yield target the calm ring tracks elapsed time', () => {
  assert.equal(calmRingProgress(12, undefined, 15_000), 0.5)
  assert.equal(calmRingProgress(undefined, 0, 45_000), 1)
})
