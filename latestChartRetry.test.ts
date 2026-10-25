import assert from 'node:assert/strict'
import test from 'node:test'
import { latestChartMessage, startLatestChartRetry, type LatestChartStatus } from '../src/features/insights/latestChartRetry.ts'

const settle = () => new Promise(resolve => setImmediate(resolve))
function harness(load: () => Promise<{ points?: unknown[] }>) {
  const states: LatestChartStatus[] = []
  const delays: number[] = []
  let callback: (() => void) | undefined
  let visible = true
  const retry = startLatestChartRetry({ load, changed: s => states.push(s), visible: () => visible,
    schedule: (run, delay) => { callback = run; delays.push(delay); return () => { callback = undefined } },
  })
  return { retry, states, delays, tick: async () => { const run = callback; callback = undefined; run?.(); await settle() }, hide: () => { visible = false }, show: () => { visible = true; retry.resume() } }
}

test('failed latest graph retries without any history status change, then stops after success', async () => {
  let calls = 0
  const h = harness(async () => { if (++calls < 3) throw Error('temporary'); return { points: [1] } })
  await settle()
  assert.deepEqual(h.states, ['loading', 'waiting'])
  await h.tick(); await h.tick(); await h.tick()
  assert.equal(calls, 3)
  assert.deepEqual(h.delays, [5000, 15000])
  assert.equal(h.states.at(-1), 'ready')
  h.retry.resume(); await settle(); assert.equal(calls, 3)
})

test('retry backoff caps at a minute and pauses while hidden', async () => {
  let calls = 0
  const h = harness(async () => { calls++; throw Error('offline') })
  await settle()
  for (let i = 0; i < 4; i++) await h.tick()
  assert.deepEqual(h.delays, [5000, 15000, 30000, 60000, 60000])
  h.hide(); await h.tick(); assert.equal(calls, 5)
  h.show(); await settle(); assert.equal(calls, 6)
  h.retry.stop(); await h.tick(); h.retry.resume(); assert.equal(calls, 6)
})

test('resume cannot overlap requests and disposed requests cannot publish or schedule retries', async () => {
  let calls = 0
  let reject!: (reason: Error) => void
  const h = harness(() => { calls++; return new Promise((_, fail) => { reject = fail }) })
  h.retry.resume(); h.retry.resume(); assert.equal(calls, 1)
  h.retry.stop(); reject(Error('late response')); await settle()
  assert.deepEqual(h.states, ['loading']); assert.deepEqual(h.delays, [])
})

test('a valid shot without points is explicitly empty, not an endless loading state', async () => {
  const h = harness(async () => ({ points: [] }))
  await settle()
  assert.equal(h.states.at(-1), 'empty'); assert.deepEqual(h.delays, [])
  assert.equal(latestChartMessage('empty'), 'No graph recorded for this shot')
  assert.match(latestChartMessage('waiting'), /retrying automatically/)
})
