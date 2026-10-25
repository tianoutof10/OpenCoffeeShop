import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceShotTimeline, beginSkipTransition, isEspressoExtractionSnapshot, isEspressoMonitoringSnapshot, observeSkipTransition, SKIP_TRANSITION_TIMEOUT_MS } from '../src/features/brew/liveShotState.ts'

test('opens monitoring while a normal Espresso shot is preparing', () => {
  const snapshot = { state: { state: 'espresso', substate: 'preparingForShot' } }
  assert.equal(isEspressoExtractionSnapshot(snapshot), false)
  assert.equal(isEspressoMonitoringSnapshot(snapshot), true)
})

test('starts the graph clock at zero on the first extraction sample', () => {
  const preparing = advanceShotTimeline(10_000, false)
  assert.deepEqual(preparing, { telemetryStartedAt: undefined, elapsedMs: 0 })

  const firstPour = advanceShotTimeline(20_000, true, preparing.telemetryStartedAt)
  assert.deepEqual(firstPour, { telemetryStartedAt: 20_000, elapsedMs: 0 })

  const nextPour = advanceShotTimeline(20_500, true, firstPour.telemetryStartedAt)
  assert.deepEqual(nextPour, { telemetryStartedAt: 20_000, elapsedMs: 500 })
})

test('keeps an active shot alive while Decaid reports the skip-step transition', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'skipStep', substate: 'pouring' } }, true), true)
})

test('freezes displayed time at the last extraction sample throughout cleanup', () => {
  const startedAt = 100_000
  const last = advanceShotTimeline(119_000, true, startedAt)
  for (const substate of ['pouringDone', 'ending', 'idle']) {
    const snapshot = { state: { state: 'espresso', substate } }
    assert.equal(isEspressoMonitoringSnapshot(snapshot), true)
    const cleanup = advanceShotTimeline(122_000, isEspressoExtractionSnapshot(snapshot), startedAt, last.elapsedMs)
    assert.equal(cleanup.elapsedMs, 19_000)
    assert.equal(cleanup.telemetryStartedAt, startedAt)
  }
})

test('resumes from the original clock after a transient skip without counting cleanup', () => {
  const start = 100_000
  const transition = beginSkipTransition(2, 119_000)
  const idle = observeSkipTransition({ state: { state: 'idle', substate: 'pouringDone' }, profileFrame: 2 }, transition, 119_200, true)
  assert.equal(idle.keepShotActive, true)
  assert.equal(advanceShotTimeline(119_200, idle.acceptTelemetry, start, 19_000).elapsedMs, 19_000)
  const resumed = observeSkipTransition({ state: { state: 'espresso', substate: 'pouring' }, profileFrame: 3 }, idle.transition, 119_400, true)
  assert.equal(advanceShotTimeline(119_400, resumed.acceptTelemetry, start, 19_000).elapsedMs, 19_400)
  assert.equal(advanceShotTimeline(120_000, false).elapsedMs, 0)
})

test('does not let an isolated skip-step snapshot start a new shot', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'skipStep', substate: 'pouring' } }), false)
})

test('continues to end a shot for a genuine idle snapshot', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'idle', substate: 'idle' } }, true), false)
})

test('recognizes normal espresso extraction snapshots', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'espresso', substate: 'pouring' } }), true)
})

test('treats espresso to skip-step to the next espresso frame as one uninterrupted shot', () => {
  let shotInProgress = false
  let completedShots = 0
  const snapshots = [
    { state: { state: 'espresso', substate: 'pouring' }, profileFrame: 2 },
    { state: { state: 'skipStep', substate: 'pouring' }, profileFrame: 2 },
    { state: { state: 'espresso', substate: 'pouring' }, profileFrame: 3 },
  ]

  for (const snapshot of snapshots) {
    const isLiveShot = isEspressoExtractionSnapshot(snapshot, shotInProgress)
    if (shotInProgress && !isLiveShot) completedShots += 1
    shotInProgress = isLiveShot
  }

  assert.equal(shotInProgress, true)
  assert.equal(completedShots, 0)
  assert.equal(snapshots.at(-1)?.profileFrame, 3)
})

test('holds an active shot across the transient stopped frame emitted by skip', () => {
  const requestedAt = 10_000
  let transition = beginSkipTransition(2, requestedAt)

  const skipState = observeSkipTransition({ state: { state: 'skipStep', substate: 'pouring' }, profileFrame: 2 }, transition, requestedAt + 100, true)
  transition = skipState.transition!
  assert.equal(skipState.keepShotActive, true)
  assert.equal(skipState.acceptTelemetry, true)

  const transientIdle = observeSkipTransition({ state: { state: 'idle', substate: 'pouringDone' }, profileFrame: 2 }, transition, requestedAt + 250, true)
  transition = transientIdle.transition!
  assert.equal(transientIdle.keepShotActive, true)
  assert.equal(transientIdle.acceptTelemetry, false)

  const nextFrame = observeSkipTransition({ state: { state: 'espresso', substate: 'pouring' }, profileFrame: 3 }, transition, requestedAt + 400, true)
  assert.equal(nextFrame.keepShotActive, true)
  assert.equal(nextFrame.acceptTelemetry, true)
  assert.equal(nextFrame.transition, null)
})

test('ends the shot if no next frame arrives before the skip transition expires', () => {
  const requestedAt = 10_000
  const transition = beginSkipTransition(4, requestedAt)
  const expiredIdle = observeSkipTransition(
    { state: { state: 'idle', substate: 'pouringDone' }, profileFrame: 4 },
    transition,
    requestedAt + SKIP_TRANSITION_TIMEOUT_MS + 1,
    true,
  )

  assert.equal(expiredIdle.keepShotActive, false)
  assert.equal(expiredIdle.acceptTelemetry, false)
  assert.equal(expiredIdle.transition, null)
})

test('does not let a skip latch mask a definitive machine state', () => {
  const requestedAt = 10_000
  const transition = beginSkipTransition(2, requestedAt)
  const error = observeSkipTransition({ state: { state: 'error', substate: 'idle' }, profileFrame: 2 }, transition, requestedAt + 100, true)

  assert.equal(error.keepShotActive, false)
  assert.equal(error.transition, null)
})
