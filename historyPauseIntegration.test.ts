import assert from 'node:assert/strict'
import test from 'node:test'
import type { PaginatedShots, ShotRecord } from '../src/api/decaid/types.ts'
import { reconcileHistory, type HistoryCache } from '../src/features/insights/historyData.ts'
import { createHistoryPacer, type HistoryPacer } from '../src/features/insights/historyPacing.ts'
import { HistoryRepository } from '../src/features/insights/historyRepository.ts'

const settle = () => new Promise(resolve => setImmediate(resolve))
const now = new Date('2026-09-17T10:00:00Z')
const graph = (id: string) => ({ id, profileName: 'Adaptive', totalTime: '29', totalYield: '36', points: [] })
function fixture(count = 201, background?: HistoryPacer) {
  let rows: ShotRecord[] = Array.from({ length: count }, (_, i) => ({
    id: String(i), timestamp: new Date(now.getTime() - i * 60000).toISOString(),
    workflow: { profile: { title: 'Adaptive', beverage_type: 'espresso' } },
  }))
  const page = (offset: number): PaginatedShots => ({ items: rows.slice(offset, offset + 100), total: rows.length, limit: 100, offset })
  let saved = reconcileHistory({ items: rows, total: count, offset: 0, limit: 1000 }, null, 'source', 'UTC', now)
  const pages: number[] = [], details: string[] = []
  const writes: HistoryCache[] = []
  let readPage = async (offset: number) => page(offset)
  let readDetail = async (id: string) => ({ ...rows.find(r => r.id === id)!, measurements: [] })
  const repo = new HistoryRepository('source', 'UTC', {
    storage: { read: async () => structuredClone(saved), write: async cache => { saved = structuredClone(cache); writes.push(saved) } },
    page: offset => { pages.push(offset); return readPage(offset) },
    detail: id => { details.push(id); return readDetail(id) },
    toDetail: raw => graph(raw.id), now: () => now, background,
  })
  return { repo, pages, details, writes, page, saved: () => saved,
    setPage: (read: typeof readPage) => { readPage = read },
    setDetail: (read: typeof readDetail) => { readDetail = read },
    prepend: () => { rows = [{ ...rows[0], id: 'new', timestamp: new Date(now.getTime() + 1000).toISOString() }, ...rows] },
  }
}

test('pausing between archive pages keeps the ready cache and resumes from a fresh head', async () => {
  let time = 0, active = true, pauseOnce = false
  const pace = createHistoryPacer(750, () => time, async ms => {
    time += ms
    if (pauseOnce) { active = false; pauseOnce = false }
  })
  const h = fixture(201, pace)
  await h.repo.refresh() // Establish a successful online snapshot.
  const before = structuredClone(h.repo.state.cache), writes = h.writes.length
  h.prepend()
  time += 750 // Allow the first page, then hide/start a brew during the next gap.
  pauseOnce = true
  assert.equal(await h.repo.refresh(true, () => active), 'paused')
  assert.deepEqual(h.pages, [0, 0])
  assert.deepEqual(structuredClone(h.repo.state.cache), before)
  assert.deepEqual(structuredClone(h.saved()), before)
  assert.equal(h.writes.length, writes)
  assert.equal(h.repo.state.status, 'ready')
  assert.equal(h.repo.state.error, null)
  assert.equal(h.repo.state.refreshing, false)
  active = true
  assert.equal(await h.repo.refresh(true, () => active), true)
  assert.deepEqual(h.pages, [0, 0, 0, 100, 200, 0])
  assert.equal(h.repo.state.cache!.records[0].id, 'new')
  assert.equal(h.repo.state.cache!.records.length, 202)
  assert.equal(new Set(h.repo.state.cache!.records.map(r => r.id)).size, 202)
})

test('pausing with a page in flight lets it finish but starts no next page or partial commit', async () => {
  const h = fixture()
  await h.repo.load()
  const before = structuredClone(h.saved()), writes = h.writes.length
  let active = true, finish!: (page: PaginatedShots) => void
  h.setPage(() => new Promise(resolve => { finish = resolve }))
  const pending = h.repo.refresh(true, () => active)
  await settle()
  active = false
  finish(h.page(0))
  assert.equal(await pending, 'paused')
  assert.deepEqual(h.pages, [0])
  assert.deepEqual(structuredClone(h.saved()), before)
  assert.equal(h.writes.length, writes)
  assert.equal(h.repo.state.error, null)
})

test('returning home while an older paused page is in flight restarts safely for the new caller', async () => {
  const h = fixture(101)
  let active = true, finish!: (page: PaginatedShots) => void
  h.setPage(() => new Promise(resolve => { finish = resolve }))
  const old = h.repo.refresh(true, () => active)
  await settle()
  active = false
  const fresh = h.repo.refresh(true, () => true)
  h.setPage(async offset => h.page(offset))
  finish(h.page(0))
  assert.equal(await old, 'paused')
  assert.equal(await fresh, true)
  assert.deepEqual(h.pages, [0, 0, 100, 0])
  assert.equal(h.repo.state.status, 'ready')
})

test('inactive or queued archive requests do not start a network read', async () => {
  let release!: () => void
  const pace = createHistoryPacer(0)
  const blocker = pace(() => new Promise<void>(resolve => { release = resolve }), () => true)
  const h = fixture(101, pace)
  let active = true
  const pending = h.repo.refresh(true, () => active)
  await settle()
  active = false
  release()
  await blocker
  assert.equal(await pending, 'paused')
  assert.equal(await h.repo.refresh(true, () => false), 'paused')
  assert.deepEqual(h.pages, [])
  assert.equal(h.repo.state.error, null)
})

test('duration reads are paced individually; already-cached reconciliation needs no network slot', async () => {
  let time = 0
  const starts: number[] = []
  const pace = createHistoryPacer(750, () => time, async ms => { time += ms })
  const h = fixture(6, pace)
  await h.repo.load()
  h.repo.state.cache!.details['0'] = graph('0')
  h.setDetail(async id => {
    starts.push(time)
    return { ...h.page(0).items.find(r => r.id === id)!, measurements: [] }
  })
  assert.equal(await h.repo.reconcileDurationBatch(), false)
  assert.deepEqual(starts, [0, 750, 1500, 2250])
  assert.equal(h.details.length, 4)
  assert.equal(h.repo.state.cache!.records.filter(r => r.durationReconciled === 1).length, 5)
  assert.deepEqual(Object.keys(h.saved().details), ['0'])
})

test('latest/opened shot bypasses a queued duration read for the same ID without downloading twice', async () => {
  let release!: () => void
  const pace = createHistoryPacer(0)
  const blocker = pace(() => new Promise<void>(resolve => { release = resolve }), () => true)
  const h = fixture(1, pace)
  const batch = h.repo.reconcileDurationBatch()
  await settle()
  assert.deepEqual(h.details, [])
  const chart = await h.repo.detail('0') // Must resolve before the background queue is released.
  assert.equal(chart.totalTime, '29')
  assert.deepEqual(h.details, ['0'])
  release()
  await blocker
  assert.equal(await batch, true)
  assert.deepEqual(h.details, ['0'])
})

test('opening a shot remains immediate during a full archive read', async () => {
  const h = fixture(101, createHistoryPacer(0))
  let release!: (page: PaginatedShots) => void
  h.setPage(() => new Promise(resolve => { release = resolve }))
  const refresh = h.repo.refresh(true)
  await settle()
  assert.equal((await h.repo.detail('0')).totalTime, '29')
  h.setPage(async offset => h.page(offset))
  release(h.page(0))
  assert.equal(await refresh, true)
  assert.deepEqual(h.details, ['0'])
  assert.equal(h.saved().details['0'].totalTime, '29')
})
