import assert from 'node:assert/strict'
import test from 'node:test'
import type { PaginatedShots, ShotRecord } from '../src/api/decaid/types.ts'
import { attachDetail, coversWindow, HISTORY_LIMIT, HISTORY_PAGE_SIZE, reconcileHistory, reportingWindow, shotRecipeLabel, validHistoryCache, type HistoryCache } from '../src/features/insights/historyData.ts'
import { FULL_HISTORY_INTERVAL, syncHistory } from '../src/features/insights/historySync.ts'
import { HistoryRepository } from '../src/features/insights/historyRepository.ts'
import { availableInsightPeriods, constrainInsightsRoute, defaultInsightsRoute, insightPeriods, readInsightsRoute, writeInsightsRoute } from '../src/features/insights/insightsRoute.ts'

const now = new Date('2026-09-13T04:00:00Z')
const source = 'http://fixture.test/api/v1'
const shots = (count: number, perDay = 2): ShotRecord[] => Array.from({ length: count }, (_, i) => ({
  id: `shot-${i}`, timestamp: new Date(now.getTime() - (i + 1) * 86400000 / perDay).toISOString(),
  workflow: { profile: { title: 'Adaptive', beverage_type: 'espresso' } }, annotations: { actualYield: 36 },
}))
const page = (records: ShotRecord[], offset: number): PaginatedShots => ({ items: records.slice(offset, offset + HISTORY_PAGE_SIZE), total: records.length, limit: HISTORY_PAGE_SIZE, offset })
const graph = (id: string) => ({ id, profileName: 'Adaptive', totalTime: '30', totalYield: '36', points: [] })
const initial = (records: ShotRecord[], total = records.length) => reconcileHistory({ items: records.slice(0, HISTORY_LIMIT), total, offset: 0, limit: HISTORY_LIMIT }, null, source, 'UTC', now)

test('fetches up to 1,000 summaries in 100-record pages, including partial and empty archives', async () => {
  for (const total of [0, 65, 100, 101, 999, 1000, 1250]) {
    const records = shots(total), calls: number[] = []
    const cache = await syncHistory(async offset => { calls.push(offset); return page(records, offset) }, null, source, 'UTC', now)
    assert.equal(cache.records.length, Math.min(total, 1000))
    assert.equal(cache.total, total)
    assert.equal(new Set(cache.records.map(r => r.id)).size, cache.records.length)
    assert.equal(validHistoryCache(cache, source), true)
    assert.deepEqual(Object.keys(cache.details), [])
    const expected = Array.from({ length: Math.max(1, Math.ceil(Math.min(total, 1000) / 100)) }, (_, i) => i * 100)
    if (total > 100) expected.push(0) // boundary check, not another cache page
    assert.deepEqual(calls, expected)
  }
})

test('old 100-record caches expand automatically without losing previously opened graphs', async () => {
  const records = shots(1200)
  let old = initial(records.slice(0, 100), 1200)
  delete old.fullSyncedAt
  old = attachDetail(old, 'shot-0', old.records[0].signature, graph('shot-0'))
  assert.equal(validHistoryCache(old, source), true)
  let persisted: HistoryCache | null = old
  let detailCalls = 0
  const deps = { storage: { read: async () => persisted, write: async (cache: HistoryCache) => { persisted = structuredClone(cache) } }, page: async (offset: number) => page(records, offset), detail: async () => { detailCalls++; throw Error('offline') }, toDetail: () => graph('shot-0'), now: () => now }
  const repo = new HistoryRepository(source, 'UTC', deps)
  await repo.refresh()
  assert.equal(repo.state.status, 'ready')
  assert.equal(repo.state.cache!.records.length, 1000)
  assert.equal((await repo.detail('shot-0')).totalTime, '30')
  assert.equal(detailCalls, 0)
  const restarted = new HistoryRepository(source, 'UTC', { ...deps, page: async () => { throw Error('offline') } })
  await restarted.refresh()
  assert.equal(restarted.state.status, 'offline')
  assert.equal(restarted.state.cache!.records.length, 1000)
  assert.equal((await restarted.detail('shot-0')).totalTime, '30')
  await assert.rejects(restarted.detail('shot-900'), /offline/)
})

test('recent sync prepends new shots without downloading older pages, trims to 1,000 and retains graphs', async () => {
  const records = shots(1200), old = initial(records)
  old.details['shot-200'] = graph('shot-200')
  old.records[200].duration = 30
  const added = shots(2).map((r, i) => ({ ...r, id: `new-${i}`, timestamp: new Date(now.getTime() + (2 - i) * 60000).toISOString() }))
  const updated = [...added, ...records], calls: number[] = []
  const cache = await syncHistory(async offset => { calls.push(offset); return page(updated, offset) }, old, source, 'UTC', new Date(now.getTime() + 60000))
  assert.deepEqual(calls, [0])
  assert.deepEqual(cache.records.slice(0, 2).map(r => r.id), ['new-0', 'new-1'])
  assert.equal(cache.records.at(-1)!.id, 'shot-997')
  assert.equal(cache.records.length, 1000)
  assert.equal(cache.details['shot-200'].totalTime, '30')
  assert.equal(cache.fullSyncedAt, old.fullSyncedAt)
  assert.notEqual(cache.syncedAt, old.syncedAt)
})

test('old edits reconcile on the next event after six hours, or immediately with explicit Refresh', async () => {
  const records = shots(1050), old = initial(records)
  old.details['shot-900'] = graph('shot-900')
  records[900] = { ...records[900], annotations: { actualYield: 42 } }
  const quick = await syncHistory(async offset => page(records, offset), old, source, 'UTC', new Date(now.getTime() + 60000))
  assert.equal(quick.records[900].yield, 36)
  const beforeDue: number[] = []
  await syncHistory(async offset => { beforeDue.push(offset); return page(records, offset) }, old, source, 'UTC', new Date(now.getTime() + FULL_HISTORY_INTERVAL - 1))
  assert.deepEqual(beforeDue, [0])
  for (const [date, force] of [[new Date(now.getTime() + FULL_HISTORY_INTERVAL), false], [now, true]] as const) {
    const calls: number[] = []
    const fresh = await syncHistory(async offset => { calls.push(offset); return page(records, offset) }, old, source, 'UTC', date, force)
    assert.equal(calls.length, 11)
    assert.equal(fresh.records[900].yield, 42)
    assert.equal(fresh.details['shot-900'], undefined)
  }
})

test('recent edits invalidate graphs without a full sweep; deletions and large imports trigger full reconciliation', async () => {
  const records = shots(1050), old = initial(records)
  old.details['shot-0'] = graph('shot-0')
  records[0] = { ...records[0], annotations: { actualYield: 39 } }
  const quick = await syncHistory(async offset => page(records, offset), old, source, 'UTC', now)
  assert.equal(quick.records[0].yield, 39)
  assert.equal(quick.details['shot-0'], undefined)
  for (const updated of [records.filter(r => r.id !== 'shot-500'), [...shots(110).map(r => ({ ...r, id: `import-${r.id}` })), ...records]]) {
    const calls: number[] = []
    const cache = await syncHistory(async offset => { calls.push(offset); return page(updated, offset) }, old, source, 'UTC', now)
    assert.ok(calls.includes(900))
    assert.equal(cache.total, updated.length)
    assert.deepEqual(new Set(cache.records.map(r => r.id)), new Set(updated.slice(0, 1000).map(r => r.id)))
  }
})

test('network failure or malformed later pages cannot replace a working offline cache', async () => {
  const records = shots(1200), old = initial(records.slice(0, 100), 1200)
  for (const failure of ['network', 'short', 'wrong-offset', 'duplicate']) {
    let writes = 0
    const repo = new HistoryRepository(source, 'UTC', {
      storage: { read: async () => old, write: async () => { writes++ } },
      page: async offset => {
        if (offset !== 500) return page(records, offset)
        if (failure === 'network') throw Error('offline')
        const result = page(records, offset)
        if (failure === 'short') result.items.pop()
        if (failure === 'wrong-offset') result.offset = 400
        if (failure === 'duplicate') result.items[0] = records[0]
        return result
      }, detail: async () => { throw Error('not requested') }, toDetail: () => graph('shot-0'), now: () => now,
    })
    await repo.refresh(true)
    assert.equal(writes, 0)
    assert.equal(repo.state.status, 'offline')
    assert.deepEqual(repo.state.cache, old)
  }
})

test('a shot added during pagination restarts once rather than storing gaps or duplicates', async () => {
  let records = shots(1050), changed = false
  const calls: number[] = []
  const cache = await syncHistory(async offset => {
    calls.push(offset)
    if (offset === 100 && !changed) { records = [{ ...records[0], id: 'new', timestamp: now.toISOString() }, ...records]; changed = true }
    return page(records, offset)
  }, null, source, 'UTC', now)
  assert.deepEqual(calls.slice(0, 3), [0, 100, 0])
  assert.equal(cache.records[0].id, 'new')
  assert.equal(cache.total, 1051)
  assert.equal(cache.records.length, 1000)
})

test('stable totals with a changing head still fail safely after one retry', async () => {
  const records = shots(200)
  let heads = 0
  await assert.rejects(syncHistory(async offset => {
    if (offset === 0) records[0] = { ...records[0], annotations: { actualYield: ++heads } }
    return structuredClone(page(records, offset))
  }, null, source, 'UTC', now), /History changed/)
  assert.equal(heads, 4)
})

test('graphs opened during a multi-page refresh are retained at commit time', async () => {
  const records = shots(200), old = initial(records)
  let resume: () => void = () => {}
  let reached: () => void = () => {}
  const waiting = new Promise<void>(resolve => { reached = resolve })
  const repo = new HistoryRepository(source, 'UTC', {
    storage: { read: async () => old, write: async () => {} },
    page: async offset => { if (offset === 100) { reached(); await new Promise<void>(resolve => { resume = resolve }) } return page(records, offset) },
    detail: async id => ({ ...records.find(r => r.id === id)!, measurements: [] }), toDetail: r => graph(r.id), now: () => now,
  })
  const refresh = repo.refresh(true)
  await waiting
  await repo.detail('shot-50')
  resume()
  await refresh
  assert.equal(repo.state.cache!.details['shot-50'].totalTime, '30')
})

test('180-day reports compare adjacent 180-day windows, with no overlap or claim of missing coverage', () => {
  const current = reportingWindow(180, 'UTC', now), previous = reportingWindow(180, 'UTC', now, true)
  assert.equal(previous.end, current.start)
  assert.equal((Date.parse(current.end) - Date.parse(previous.start)) / 86400000, 360)
  assert.equal((Date.parse(current.end) - Date.parse(current.start)) / 86400000, 180)
  const covered = initial(shots(1200, 2))
  assert.ok(coversWindow(covered, current)); assert.ok(coversWindow(covered, previous))
  const busy = initial(shots(1200, 4))
  assert.ok(coversWindow(busy, current)); assert.equal(coversWindow(busy, previous), false)
  const cutDay = initial([{ ...shots(1)[0], timestamp: `${previous.start}T00:00:00Z` }], 1200)
  assert.equal(coversWindow(cutDay, previous), false)
})

test('7/30/180-day routes retain period, filter and previous selection through detail and back', () => {
  assert.deepEqual(insightPeriods, [7, 30, 180])
  for (const days of insightPeriods) {
    const route = readInsightsRoute(new URLSearchParams(`insSection=history&insDays=${days}&insPrevious=1&insKind=weekday&insValue=2&shotId=shot-20`))
    assert.equal(route.days, days); assert.equal(route.previous, true)
    assert.deepEqual(readInsightsRoute(writeInsightsRoute(new URL('http://localhost'), route).searchParams), route)
  }
  assert.equal(readInsightsRoute(new URLSearchParams('insDays=28')).days, 30)
  for (const invalid of [160, 365, -1, 9999]) assert.equal(readInsightsRoute(new URLSearchParams(`insDays=${invalid}`)).days, 7)
})

test('180-day option needs 180 calendar days of covered history, not 180 records or brewing days', () => {
  assert.deepEqual(availableInsightPeriods(null, now), [7, 30])
  assert.deepEqual(availableInsightPeriods(initial(shots(1000, 20)), now), [7, 30])
  const start = reportingWindow(180, 'UTC', now).start
  const sparse = initial([{ ...shots(1)[0], timestamp: `${start}T07:00:00Z` }])
  assert.deepEqual(availableInsightPeriods(sparse, now), [7, 30, 180])
  // A cutoff inside the oldest day isn't a fully covered 180-day period.
  assert.deepEqual(availableInsightPeriods({ ...sparse, total: 1500 }, now), [7, 30])
  assert.deepEqual(availableInsightPeriods({ ...sparse, omitted: 1 }, now), [7, 30])
  assert.deepEqual(availableInsightPeriods(initial([]), now), [7, 30])
  const sixMonthsOnly = initial(shots(400))
  assert.deepEqual(availableInsightPeriods(sixMonthsOnly, now), [7, 30, 180])
  assert.deepEqual(availableInsightPeriods({ ...sixMonthsOnly, syncedAt: '2026-09-12T12:00:00Z' }, now), [7, 30])
})

test('unavailable 180-day bookmarks fall back to 30 days without losing the selected shot', () => {
  const route = { ...defaultInsightsRoute, days: 180 as const, previous: true, filter: { kind: 'weekday' as const, value: '2' }, shotId: 'shot-1' }
  assert.deepEqual(constrainInsightsRoute(route, [7, 30]), { ...route, days: 30, previous: false, filter: null })
  assert.equal(constrainInsightsRoute(route, [7, 30, 180]), route)
  assert.equal(constrainInsightsRoute(defaultInsightsRoute, [7, 30]), defaultInsightsRoute)
})

test('latest-shot chip appends actual duration in seconds without inventing missing metrics', () => {
  assert.equal(shotRecipeLabel({ dose: 20, yield: 36.2, duration: 30 }), '20 → 36.2 g • 30s')
  assert.equal(shotRecipeLabel({ dose: null, yield: 0, duration: 0 }), '0.0 g • 0s')
  assert.equal(shotRecipeLabel({ dose: 18, yield: null, duration: null }), '18 → — • —s')
})
