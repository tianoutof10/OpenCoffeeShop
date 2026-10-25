import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { BACKFILL_GAP_MS, PAGE_GAP_MS, createHistoryPacer, HistoryPaused } from '../src/features/insights/historyPacing.ts'
import { FULL_HISTORY_INTERVAL } from '../src/features/insights/historySync.ts'

function clock() {
  let t = 0
  const slept: number[] = []
  return { now: () => t, sleep: async (ms: number) => { slept.push(ms); t += ms }, advance: (ms: number) => { t += ms }, slept }
}
test('background pages and details share a serial queue, spaced from completion', async () => {
  const c = clock(), starts: number[] = []
  const pace = createHistoryPacer(750, c.now, c.sleep)
  const read = (id: string) => pace(async () => { starts.push(c.now()); c.advance(600); return id }, () => true)
  assert.deepEqual(await Promise.all([read('page'), read('detail'), read('page')]), ['page', 'detail', 'page'])
  assert.deepEqual(starts, [0, 1350, 2700])
})
test('first read is immediate; a failed read still paces the next', async () => {
  const c = clock()
  const pace = createHistoryPacer(750, c.now, c.sleep)
  await assert.rejects(pace(async () => { c.advance(100); throw Error('offline') }, () => true))
  assert.deepEqual(c.slept, [])
  assert.equal(await pace(async () => 'ok', () => true), 'ok')
  assert.deepEqual(c.slept, [750])
})
test('pausing while waiting or queued prevents requests without poisoning future reads', async () => {
  const c = clock()
  let active = true, reads = 0
  const pace = createHistoryPacer(750, c.now, async ms => { await c.sleep(ms); active = false })
  const read = () => pace(async () => ++reads, () => active)
  assert.equal(await read(), 1)
  await assert.rejects(read(), HistoryPaused)
  await assert.rejects(read(), HistoryPaused)
  assert.equal(reads, 1)
  active = true
  assert.equal(await read(), 2)
})
test('early timer wake-ups cannot violate the gap', async () => {
  const c = clock()
  const pace = createHistoryPacer(750, c.now, async ms => c.advance(Math.min(ms, 250)))
  await pace(async () => 0, () => true)
  await pace(async () => { assert.equal(c.now(), 750) }, () => true)
})
test('repository-owned queue/cooldown are wired only to background maintenance', () => {
  const hook = readFileSync(new URL('../src/features/insights/useShotInsights.ts', import.meta.url), 'utf8')
  assert.ok(hook.includes('background: createHistoryPacer()'))
  assert.ok(hook.includes('cooldown: repository.durationCooldown'))
  assert.ok(hook.includes('minimumGapMs: BACKFILL_GAP_MS'))
  assert.ok(hook.includes('return repository.refresh(force, canContinue)'))
  assert.equal(PAGE_GAP_MS, 750)
  assert.equal(BACKFILL_GAP_MS, 4000)
  assert.equal(FULL_HISTORY_INTERVAL, 6 * 60 * 60 * 1000)
})
