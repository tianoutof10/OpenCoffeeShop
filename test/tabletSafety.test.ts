import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { shouldAutoTareAtShotStart } from '../src/features/brew/liveShotState.ts'
import { createStopObservation, requestMachineStop, type StopObservation } from '../src/features/brew/stopRequest.ts'
import { createBackgroundScaleSearch, type ScaleSearchState } from '../src/features/brew/backgroundScaleSearch.ts'
import { backgroundScaleScanDelayMs, BACKGROUND_SCALE_SCAN_MAX_DELAY_MS, shouldRunBackgroundScaleScan } from '../src/features/brew/sleepControl.ts'

const brewingSource = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')

test('auto-tare is allowed during preparation, never on a mid-shot reconnect', () => {
  for (const substate of ['preparingForShot', 'PreparingForShot']) assert.equal(shouldAutoTareAtShotStart({ state: { state: 'Espresso', substate } }), true)
  for (const substate of ['preinfusion', 'pouring', 'pouringDone', 'idle']) assert.equal(shouldAutoTareAtShotStart({ state: { state: 'espresso', substate }, profileFrame: 2 }), false)
  for (const state of ['espresso', 'skipStep', 'hotWater']) assert.equal(shouldAutoTareAtShotStart({ state }), false)
  const silentTares = brewingSource.match(/.*requestScaleTare\(true\).*/g) ?? []
  assert.equal(silentTares.length, 1)
  assert.match(silentTares[0], /if \(shouldAutoTareAtShotStart\(snapshot\)\)/)
})

const stamp = (ms: number) => new Date(1_800_000_000_000 + ms).toISOString()
const snapshot = (state: string, ms = 1) => ({ state: { state }, timestamp: stamp(ms) })

test('only a fresh explicit non-shot snapshot confirms a stop', () => {
  const session = {}
  const evidence = createStopObservation(session, stamp(0))
  for (const frame of [snapshot('espresso'), snapshot('skipStep'), snapshot('cleaning'), snapshot('unknown'), snapshot('idle', -1), snapshot('idle', 0), { state: 'idle' }]) {
    evidence.observe(frame, session)
    assert.equal(evidence.status(session), 'pending')
  }
  evidence.observe(snapshot('idle'), session)
  assert.equal(evidence.status(null), 'confirmed')
})

test('missing initial timestamp cannot manufacture confirmation', () => {
  const session = {}
  const evidence = createStopObservation(session, undefined)
  evidence.observe(snapshot('idle'), session)
  assert.equal(evidence.status(session), 'pending')
})

test('losing the connection is not confirmation, even after reconnecting', () => {
  const session = {}
  const evidence = createStopObservation(session, stamp(0))
  evidence.disconnect()
  evidence.observe(snapshot('idle'), session)
  assert.equal(evidence.status(null), 'disconnected')
  assert.equal(evidence.status({}), 'disconnected')
})

test('session replacement/disappearance cannot confirm or stop a newer shot', () => {
  const session = {}, newer = {}
  const evidence = createStopObservation(session, stamp(0))
  assert.equal(evidence.status(null), 'superseded')
  evidence.observe(snapshot('idle'), newer)
  assert.equal(evidence.status(newer), 'superseded')
})

test('an already-confirmed stop is not invalidated by a later disconnect', () => {
  const session = {}
  const evidence = createStopObservation(session, stamp(0))
  evidence.observe(snapshot('sleeping'), session)
  evidence.disconnect()
  assert.equal(evidence.status(null), 'confirmed')
})

function stopHarness(afterSend: (send: number) => StopObservation = () => 'pending', reject = false) {
  let status: StopObservation = 'pending'
  let sends = 0
  const waits: number[] = []
  return {
    get sends() { return sends }, waits,
    api: {
      observation: () => status,
      sendIdle: async () => { status = afterSend(++sends); if (reject) throw new Error('network failure') },
      wait: async (ms: number) => { waits.push(ms) },
    },
  }
}

test('confirmed stop finishes immediately without an unnecessary wait or retry', async () => {
  const h = stopHarness(() => 'confirmed')
  assert.equal(await requestMachineStop(h.api), 'confirmed')
  assert.equal(h.sends, 1)
  assert.deepEqual(h.waits, [])
})

test('accepted but unconfirmed stop retries once and releases the caller', async () => {
  const h = stopHarness()
  assert.equal(await requestMachineStop(h.api), 'unconfirmed')
  assert.equal(h.sends, 2)
  assert.deepEqual(h.waits, [2500, 2500])
  const recovered = stopHarness(send => send === 2 ? 'confirmed' : 'pending')
  assert.equal(await requestMachineStop(recovered.api), 'confirmed')
  assert.equal(recovered.sends, 2)
})

test('failed/aborted requests stay distinct from telemetry confirmation', async () => {
  const h = stopHarness(() => 'pending', true)
  assert.equal(await requestMachineStop(h.api), 'failed')
  assert.equal(h.sends, 2)
  const acceptedBeforeTimeout = stopHarness(() => 'confirmed', true)
  assert.equal(await requestMachineStop(acceptedBeforeTimeout.api), 'confirmed')
})

test('disconnect or new shot during the confirmation wait prevents retry', async () => {
  for (const next of ['disconnected', 'superseded'] as const) {
    const h = stopHarness()
    let status: StopObservation = 'pending'
    assert.equal(await requestMachineStop({ ...h.api, observation: () => status, wait: async () => { status = next } }), next)
    assert.equal(h.sends, 1)
  }
})

test('disconnect while the request is in flight does not retry after it settles', async () => {
  const h = stopHarness(() => 'disconnected', true)
  assert.equal(await requestMachineStop(h.api), 'disconnected')
  assert.equal(h.sends, 1)
  assert.deepEqual(h.waits, [])
})

function searchHarness() {
  let state: ScaleSearchState = { preferredScaleId: 'scale', scaleConnected: false, machineConnected: true, readiness: 'ready', machineBusy: false }
  let nextId = 0, scans = 0
  const timers = new Map<number, { callback(): void; delay: number }>()
  let scan: () => Promise<unknown> = async () => undefined
  const search = createBackgroundScaleSearch({
    state: () => state,
    scan: () => { scans++; return scan() },
    schedule: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id },
    cancel: id => { timers.delete(id) },
  })
  search.refresh()
  return {
    search, timers,
    get scans() { return scans },
    get delay() { return timers.values().next().value?.delay },
    set(patch: Partial<ScaleSearchState>) { state = { ...state, ...patch }; search.refresh() },
    setScan(next: () => Promise<unknown>) { scan = next },
    async fire() { const [id, timer] = timers.entries().next().value!; timers.delete(id); timer.callback(); await Promise.resolve(); await Promise.resolve() },
  }
}

test('background scans back off from five seconds to five minutes', async () => {
  assert.equal(backgroundScaleScanDelayMs(500), BACKGROUND_SCALE_SCAN_MAX_DELAY_MS)
  assert.equal(backgroundScaleScanDelayMs(-3), 5000)
  const h = searchHarness()
  for (const delay of [5000, 10000, 20000, 40000, 80000, 160000, 300000, 300000]) {
    assert.equal(h.delay, delay)
    await h.fire()
  }
  assert.equal(h.scans, 8)
  h.search.dispose()
})

test('telemetry does not continually postpone a scheduled scan', async () => {
  const h = searchHarness()
  await h.fire()
  const id = h.timers.keys().next().value
  for (let i = 0; i < 50; i++) h.search.refresh()
  assert.equal(h.timers.keys().next().value, id)
  assert.equal(h.delay, 10000)
})

test('wake, reconnect, preferred-scale change and returning to app reset pending delay', async () => {
  for (const event of ['wake', 'reconnect', 'scale', 'preference', 'resume'] as const) {
    const h = searchHarness()
    for (let i = 0; i < 6; i++) await h.fire()
    assert.equal(h.delay, 300000)
    if (event === 'wake') { h.set({ readiness: 'sleeping' }); assert.equal(h.delay, undefined); h.set({ readiness: 'ready' }) }
    if (event === 'reconnect') { h.set({ machineConnected: false }); assert.equal(h.delay, undefined); h.set({ machineConnected: true }) }
    if (event === 'scale') { h.set({ scaleConnected: true }); assert.equal(h.delay, undefined); h.set({ scaleConnected: false }) }
    if (event === 'preference') h.set({ preferredScaleId: 'other' })
    if (event === 'resume') h.search.reset()
    assert.equal(h.delay, 5000, event)
  }
})

test('busy, sleeping, disconnected or unknown machine cancels queued scans', () => {
  for (const patch of [{ machineBusy: true }, { readiness: 'sleeping' as const }, { machineConnected: false }, { readiness: null }, { preferredScaleId: null }, { scaleConnected: true }]) {
    const h = searchHarness()
    h.set(patch)
    assert.equal(h.timers.size, 0)
    assert.equal(h.scans, 0)
  }
  assert.equal(shouldRunBackgroundScaleScan('scale', false, 'ready', true), false)
})

test('a reset during an in-flight scan does not create overlap or restore the old backoff', async () => {
  const h = searchHarness()
  await h.fire()
  let finish!: () => void
  h.setScan(() => new Promise<void>(resolve => { finish = resolve }))
  await h.fire()
  h.search.reset()
  assert.equal(h.timers.size, 0)
  finish()
  await Promise.resolve(); await Promise.resolve()
  assert.equal(h.delay, 5000)
  assert.equal(h.scans, 2)
})

test('disposal prevents timers and async scan completion from restarting searches', async () => {
  const h = searchHarness()
  let finish!: () => void
  h.setScan(() => new Promise<void>(resolve => { finish = resolve }))
  await h.fire()
  h.search.dispose()
  finish()
  await Promise.resolve(); await Promise.resolve()
  h.search.reset()
  assert.equal(h.timers.size, 0)
})

test('hook wires confirmation before session completion, disconnects and scan cleanup', () => {
  assert.ok(brewingSource.indexOf('evidence.observe(snapshot, liveShotSession.current)') < brewingSource.indexOf('const skipObservation ='))
  assert.match(brewingSource, /evidence.disconnect\(\)/)
  assert.match(brewingSource, /pendingStopRequest.current !== request/)
  assert.match(brewingSource, /backgroundScaleSearch.dispose\(\)/)
  assert.match(brewingSource, /document.removeEventListener\('visibilitychange', resumeScaleSearch\)/)
  assert.match(brewingSource, /t\('brew\.data\.error\.stopTrackingLost'\)/)
  const manual = brewingSource.slice(brewingSource.indexOf('const searchForScale ='), brewingSource.indexOf('const connectToScale ='))
  assert.match(manual, /await runScaleScan\(\)/)
  assert.doesNotMatch(manual, /backgroundScaleSearch/)
})

test('existing hot-water and flush settings policy is retained for separate review', () => {
  assert.match(brewingSource, /const patch = hotWaterWeightStoppingPatch\(current\)/)
  assert.match(brewingSource, /rinseWorkflowPatchFromMachineSettings\(workflow, machineSettings\)/)
  assert.match(brewingSource, /hotWaterSettings.reconcile\(/)
  assert.match(brewingSource, /isHotWater \? hotWaterSettings.save\(update.patch\)/)
})
