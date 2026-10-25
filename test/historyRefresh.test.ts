import assert from 'node:assert/strict'
import test from 'node:test'
import { createHistoryRefresh } from '../src/features/insights/historyRefresh.ts'
const settle = () => new Promise(resolve => setImmediate(resolve))
function setup(refresh: (force: boolean, canContinue: () => boolean) => Promise<boolean | 'paused'>) {
  let callback: (() => void) | undefined
  let visible = true
  const delays: number[] = []
  const control = createHistoryRefresh({ refresh, visible: () => visible,
    schedule: (run, delay) => { callback = run; delays.push(delay); return () => { callback = undefined } },
  })
  return { control, delays, hide: () => { visible = false }, show: () => { visible = true }, tick: async () => { const fn = callback; callback = undefined; fn?.(); await settle() } }
}
test('successful sync stays quiet until an explicit event or manual request', async () => {
  const calls: boolean[] = []
  const h = setup(async force => { calls.push(force); return true })
  await h.control.request(); await h.tick(); h.control.retryFailed(); await settle()
  assert.deepEqual(calls, [false]); assert.deepEqual(h.delays, [])
  await h.control.request(true); assert.deepEqual(calls, [false, true])
})
test('failed sync backs off, stops on success, and preserves forced refresh on retry', async () => {
  const calls: boolean[] = []
  const h = setup(async force => { calls.push(force); return calls.length >= 6 })
  await h.control.request(true)
  for (let i = 0; i < 6; i++) await h.tick()
  assert.deepEqual(h.delays, [5000, 15000, 30000, 60000, 60000])
  assert.deepEqual(calls, Array(6).fill(true))
  h.control.retryFailed(); await settle(); assert.equal(calls.length, 6)
})
test('hidden pages pause failures and returning resumes without overlapping requests', async () => {
  let calls = 0
  const h = setup(async () => { calls++; throw Error('offline') })
  await h.control.request(); h.hide(); await h.tick()
  assert.equal(calls, 1)
  h.show(); h.control.retryFailed(); h.control.retryFailed(); await settle()
  assert.equal(calls, 2)
  h.control.stop(); await h.tick(); await h.control.request(); assert.equal(calls, 2)
})
test('cleanup prevents late failures from scheduling retries', async () => {
  let complete!: (success: boolean) => void
  const h = setup(() => new Promise(resolve => { complete = resolve }))
  const pending = h.control.request(); await settle(); h.control.stop(); complete(false); await pending
  assert.deepEqual(h.delays, [])
})

test('an intentional pause stays quiet and the next visible event resumes a forced scan', async () => {
  const calls: boolean[] = []
  let canContinue!: () => boolean
  let finish!: (value: 'paused') => void
  const h = setup(async (force, guard) => {
    calls.push(force); canContinue = guard
    return calls.length === 1 ? new Promise(resolve => { finish = resolve }) : true
  })
  const pending = h.control.request(true)
  await settle()
  assert.equal(canContinue(), true)
  h.hide()
  assert.equal(canContinue(), false)
  finish('paused')
  await pending
  assert.deepEqual(h.delays, [])
  h.control.retryFailed()
  await settle()
  assert.equal(calls.length, 1)
  h.show()
  await h.control.request()
  assert.deepEqual(calls, [true, true])
  h.control.stop()
  assert.equal(canContinue(), false)
})

test('explicit Refresh during an in-flight incremental sync still forces the next scan', async () => {
  let finish!: (success: boolean) => void
  const calls: boolean[] = []
  const h = setup(async force => {
    calls.push(force)
    return calls.length === 1 ? new Promise(resolve => { finish = resolve }) : true
  })
  const first = h.control.request()
  await settle()
  const forced = h.control.request(true)
  assert.deepEqual(calls, [false])
  finish(true)
  await Promise.all([first, forced])
  assert.deepEqual(calls, [false, true])
  assert.deepEqual(h.delays, [])
})
