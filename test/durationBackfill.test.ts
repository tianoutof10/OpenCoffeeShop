import assert from 'node:assert/strict'
import test from 'node:test'
import type { ShotRecord } from '../src/api/decaid/types.ts'
import { reconcileHistory, type HistoryCache } from '../src/features/insights/historyData.ts'
import { HistoryRepository } from '../src/features/insights/historyRepository.ts'
import { startDurationBackfill } from '../src/features/insights/durationBackfill.ts'

const shot = (id: string): ShotRecord => ({ id, timestamp: '2026-09-12T07:00:00Z', workflow: { profile: { title: 'Adaptive', beverage_type: 'espresso' } } })
const graph = (id: string, duration = '29') => ({ id, profileName: 'Adaptive', totalTime: duration, totalYield: '36' })
function setup(count = 8) {
  const shots = Array.from({ length: count }, (_, i) => shot(String(i)))
  const page = { items: shots, total: count, limit: 100, offset: 0 }
  let saved: HistoryCache = reconcileHistory(page, null, 'source', 'UTC')
  const calls: string[] = []
  let fetchDetail = async (id: string): Promise<ShotRecord> => ({ ...shot(id), measurements: [] })
  const deps = {
    storage: { read: async () => structuredClone(saved), write: async (value: HistoryCache) => { saved = structuredClone(value) } },
    page: async () => page,
    detail: async (id: string) => { calls.push(id); return fetchDetail(id) },
    toDetail: (raw: ShotRecord) => graph(raw.id, raw.id === '0' ? '—' : '29'),
  }
  return { repo: new HistoryRepository('source', 'UTC', deps), calls, saved: () => saved,
    fetch: (fn: typeof fetchDetail) => { fetchDetail = fn }, restart: () => new HistoryRepository('source', 'UTC', deps) }
}
test('legacy cache backfills in small batches, persists only metadata and never repeats completed records', async () => {
  const h = setup()
  await h.repo.load()
  h.repo.state.cache!.records.find(r => r.id === '1')!.duration = 0
  h.repo.state.cache!.details['2'] = graph('2')
  assert.equal(await h.repo.reconcileDurationBatch(), false)
  assert.ok(h.calls.length <= 5)
  assert.equal(await h.repo.reconcileDurationBatch(), true)
  assert.equal(h.calls.length, 6)
  assert.equal(h.repo.state.cache!.records.find(r => r.id === '1')!.duration, 0)
  assert.equal(h.repo.state.cache!.records.find(r => r.id === '0')!.duration, null)
  assert.equal(h.repo.state.cache!.records.find(r => r.id === '0')!.durationReconciled, 1)
  assert.deepEqual(Object.keys(h.saved().details), ['2'])
  const restarted = h.restart()
  await restarted.refresh(true)
  assert.equal(await restarted.reconcileDurationBatch(), true)
  assert.equal(h.calls.length, 6)
})
test('failed read preserves batch progress and resumes remaining records after restart', async () => {
  const h = setup(3)
  let count = 0
  h.fetch(async id => { if (++count === 2) throw Error('offline'); return { ...shot(id), measurements: [] } })
  await assert.rejects(h.repo.reconcileDurationBatch(), /offline/)
  assert.equal(h.saved().records.filter(r => r.durationReconciled === 1).length, 1)
  const first = h.calls[0]
  assert.equal(await h.restart().reconcileDurationBatch(), true)
  assert.equal(h.calls.filter(id => id === first).length, 1)
})
test('a full 1,000-record legacy cache completes once without retaining the downloaded graphs', async () => {
  const h = setup(1000)
  let batches = 0
  do { batches++ } while (!await h.repo.reconcileDurationBatch())
  assert.equal(batches, 200)
  assert.equal(new Set(h.calls).size, 1000)
  assert.equal(h.calls.length, 1000)
  assert.equal(h.saved().records.filter(r => r.durationReconciled === 1).length, 1000)
  assert.equal(Object.keys(h.saved().details).length, 0)
  await h.restart().reconcileDurationBatch()
  assert.equal(h.calls.length, 1000)
})
test('missing shots do not block later records; invalid responses are not marked complete', async () => {
  const h = setup(2)
  h.fetch(async id => { if (id === '1') throw Object.assign(Error('gone'), { status: 404 }); return { ...shot(id), measurements: [] } })
  assert.equal(await h.repo.reconcileDurationBatch(), true)
  assert.equal(h.saved().records.find(r => r.id === '1')!.duration, null)
  const invalid = setup(1)
  invalid.fetch(async () => ({ ...shot('wrong'), measurements: [] }))
  await assert.rejects(invalid.repo.reconcileDurationBatch(), /measurements/)
  assert.equal(invalid.saved().records[0].durationReconciled, undefined)
})
test('pause stops new requests and concurrent callers share the same batch', async () => {
  const h = setup(8)
  let active = true
  h.fetch(async id => { active = false; return { ...shot(id), measurements: [] } })
  const a = h.repo.reconcileDurationBatch(() => active)
  const b = h.repo.reconcileDurationBatch(() => active)
  assert.equal(a, b)
  assert.equal(await a, false)
  assert.equal(h.calls.length, 1)
  await h.repo.reconcileDurationBatch(() => false)
  assert.equal(h.calls.length, 1)
})
test('in-flight duration cannot attach to an edited or deleted cached record', async () => {
  const h = setup(2)
  h.fetch(async id => {
    const cache = h.repo.state.cache!
    cache.records = id === '1' ? cache.records.map(r => r.id === id ? { ...r, signature: 'new-revision' } : r) : cache.records.filter(r => r.id !== id)
    return { ...shot(id), measurements: [] }
  })
  assert.equal(await h.repo.reconcileDurationBatch(), false)
  assert.equal(h.saved().records.length, 1)
  assert.equal(h.saved().records[0].duration, null)
  assert.equal(h.saved().records[0].durationReconciled, undefined)
})
test('duration reconciliation and opening the graph share a single network read', async () => {
  const h = setup(1)
  let finish!: (value: ShotRecord) => void
  h.fetch(() => new Promise(resolve => { finish = resolve }))
  const batch = h.repo.reconcileDurationBatch()
  await new Promise(resolve => setImmediate(resolve))
  const detail = h.repo.detail('0')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 1)
  finish({ ...shot('0'), measurements: [] })
  await Promise.all([batch, detail])
})
test('background runner paces batches, retries only failures and stops on completion', async () => {
  let timer: (() => void) | undefined
  let now = 0, due = 0
  const delays: number[] = []
  let calls = 0
  const runner = startDurationBackfill({
    now: () => now,
    batch: async () => { calls++; if (calls === 2) throw Error('offline'); return calls >= 3 },
    visible: () => true,
    schedule: (fn, delay) => { timer = fn; due = now + delay; delays.push(delay); return () => { timer = undefined } },
  })
  const tick = async () => { await new Promise(resolve => setImmediate(resolve)); const fn = timer; timer = undefined; now = due; fn?.(); await new Promise(resolve => setImmediate(resolve)) }
  await tick(); await tick(); await tick()
  assert.deepEqual(delays, [1000, 5000])
  runner.resume(); assert.equal(calls, 3)
  runner.stop()
})

test('online and visibility resumes cannot bypass the batch cooldown, including after remount', async () => {
  let now = 0
  const cooldown = { nextAt: 0 }
  const calls: number[] = []
  const timers = new Map<() => void, number>()
  const options = {
    now: () => now, cooldown, minimumGapMs: 4000, visible: () => true,
    batch: async () => { calls.push(now); return false },
    schedule: (run: () => void, delay: number) => { timers.set(run, now + delay); return () => { timers.delete(run) } },
  }
  const settle = () => new Promise(resolve => setImmediate(resolve))
  const first = startDurationBackfill(options)
  await settle()
  assert.deepEqual(calls, [0])
  now = 100
  first.resume(); first.resume()
  await settle()
  assert.deepEqual(calls, [0])
  assert.deepEqual([...timers.values()], [4000])
  first.stop()
  const next = startDurationBackfill(options)
  await settle()
  assert.deepEqual(calls, [0])
  now = 3999
  next.resume()
  await settle()
  assert.deepEqual(calls, [0])
  now = 4000
  next.resume()
  await settle()
  assert.deepEqual(calls, [0, 4000])
  next.stop()
  assert.equal(timers.size, 0)
})

test('a failed duration batch keeps its longer retry delay on external resume', async () => {
  let now = 0, calls = 0
  const scheduled: number[] = []
  const runner = startDurationBackfill({
    now: () => now, minimumGapMs: 4000, visible: () => true,
    batch: async () => { calls++; throw Error('offline') },
    schedule: (_run, delay) => { scheduled.push(now + delay); return () => {} },
  })
  const settle = () => new Promise(resolve => setImmediate(resolve))
  await settle()
  now = 4000
  runner.resume()
  await settle()
  assert.equal(calls, 1)
  assert.deepEqual(scheduled, [5000, 5000])
  now = 5000
  runner.resume()
  await settle()
  assert.equal(calls, 2)
  assert.equal(scheduled.at(-1), 20000)
  runner.stop()
})

test('stopping a runner before its deferred start prevents any batch', async () => {
  let calls = 0
  const runner = startDurationBackfill({
    batch: async () => { calls++; return false }, visible: () => true,
    schedule: () => { assert.fail('stopped runners cannot schedule'); return () => {} },
  })
  runner.stop()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 0)
})
