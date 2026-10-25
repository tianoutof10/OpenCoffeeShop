import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { appendLiveShotSample, advanceShotTimeline } from '../src/features/brew/liveShotState.ts'
import type { LiveShotPoint } from '../src/domain/brewing.ts'

test('long live shots retain every sample and early-stage boundary beyond 900 points', () => {
  // Twenty minutes at 10 Hz, well beyond both the old cap and the reported tea shot.
  const points: LiveShotPoint[] = []
  const expected = Array.from({ length: 12001 }, (_, i) => ({
    elapsedMs: i * 100, stageIndex: Math.min(6, Math.floor(i / 200)),
    pressure: i % 12, flow: (i % 40) / 10, weight: i / 100,
    targetPressure: 7, targetFlow: 2, temperature: 94, weightFlow: 0.1,
  }))
  for (const point of expected) assert.equal(appendLiveShotSample(points, point), true)
  assert.deepEqual(points, expected)
  assert.equal(points[0].elapsedMs, 0)
  assert.equal(points.at(-1)?.elapsedMs, 1200000)
  assert.deepEqual([...new Set(points.map(point => point.stageIndex))], [0, 1, 2, 3, 4, 5, 6])
  // Completed-shot snapshots retain the same full timeline, independently of future appends.
  const completed = [...points]
  const nextShot: LiveShotPoint[] = []
  appendLiveShotSample(nextShot, { elapsedMs: 0, pressure: 0 })
  assert.equal(completed.length, 12001)
  assert.equal(nextShot.length, 1)
})

test('duplicate, out-of-order and invalid times do not replace valid shot samples', () => {
  const points: LiveShotPoint[] = []
  assert.equal(appendLiveShotSample(points, { elapsedMs: 0 }), true)
  assert.equal(appendLiveShotSample(points, { elapsedMs: 100 }), true)
  for (const elapsedMs of [100, 0, 50, -1, NaN, Infinity]) {
    assert.equal(appendLiveShotSample(points, { elapsedMs }), false)
  }
  assert.deepEqual(points, [{ elapsedMs: 0 }, { elapsedMs: 100 }])
  assert.equal(appendLiveShotSample(points, { elapsedMs: 200 }), true)
  assert.equal(advanceShotTimeline(10000, false, 1000, points.at(-1)?.elapsedMs).elapsedMs, 200)
})

test('production live ingestion uses full-shot retention without a rolling shift', () => {
  const source = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
  assert.match(source, /appendLiveShotSample\(session\.points,/)
  assert.doesNotMatch(source, /MAX_LIVE_SHOT_POINTS|session\.points\.shift\(/)
})
