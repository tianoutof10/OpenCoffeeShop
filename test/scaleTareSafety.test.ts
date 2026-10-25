import assert from 'node:assert/strict'
import test from 'node:test'
import { observeTareShotState, requestGuardedScaleTare, scaleTareBlocked, type ScaleTareState } from '../src/features/brew/scaleTareSafety.ts'

const idle = (): ScaleTareState => ({ blockDuringShot: true, shotActive: false, machineKnown: true, scaleConnected: true, preparing: false })

test('tare lock spans preparation, pouring, skips and cleanup; releases at idle', () => {
  for (const substate of ['preparingForShot', 'preinfusion', 'pouring', 'pouringDone']) {
    assert.equal(observeTareShotState(false, { state: { state: 'Espresso', substate } }), true)
  }
  assert.equal(observeTareShotState(false, { state: 'skipStep' }), true)
  assert.equal(observeTareShotState(true, {}), true)
  for (const state of ['idle', 'sleeping', 'hotWater', 'steam', 'flush', 'cleaning']) {
    assert.equal(observeTareShotState(true, { state }), false)
  }
})

test('unknown settings or machine state cannot bypass a possible active-shot lock', () => {
  assert.equal(scaleTareBlocked({ ...idle(), blockDuringShot: undefined, shotActive: true }), true)
  assert.equal(scaleTareBlocked({ ...idle(), machineKnown: false }), true)
  assert.equal(scaleTareBlocked({ ...idle(), blockDuringShot: false, shotActive: true }), false)
  assert.equal(scaleTareBlocked(idle()), false)
})

test('enabled lock prevents the outgoing tare, even when server would accept it', async () => {
  let requests = 0
  const result = await requestGuardedScaleTare({
    readState: () => ({ ...idle(), shotActive: true }),
    refreshSettings: async () => {}, sendTare: async () => { requests++ },
  })
  assert.equal(result, 'blocked')
  assert.equal(requests, 0)
})

test('fresh settings and latest shot state are checked after an asynchronous read', async () => {
  const state = idle()
  state.blockDuringShot = false
  let requests = 0
  const result = await requestGuardedScaleTare({
    readState: () => state,
    refreshSettings: async () => { state.blockDuringShot = true; state.shotActive = true },
    sendTare: async () => { requests++ },
  })
  assert.equal(result, 'blocked')
  assert.equal(requests, 0)
})

test('tare remains available at idle and during a shot when protection is disabled', async () => {
  for (const state of [idle(), { ...idle(), blockDuringShot: false, shotActive: true }]) {
    let requests = 0
    assert.equal(await requestGuardedScaleTare({ readState: () => state, refreshSettings: async () => {}, sendTare: async () => { requests++ } }), 'tared')
    assert.equal(requests, 1)
  }
})

test('failed settings read never sends tare', async () => {
  let requests = 0
  await assert.rejects(requestGuardedScaleTare({ readState: idle, refreshSettings: async () => { throw new Error('offline') }, sendTare: async () => { requests++ } }), /offline/)
  assert.equal(requests, 0)
})

test('scale disconnect while checking settings prevents tare', async () => {
  const state = idle()
  assert.equal(await requestGuardedScaleTare({ readState: () => state, refreshSettings: async () => { state.scaleConnected = false }, sendTare: async () => { assert.fail('must not tare') } }), 'disconnected')
})

test('automatic tare cannot run late into pouring even with protection disabled', async () => {
  const state = { ...idle(), blockDuringShot: false, shotActive: true, preparing: true }
  assert.equal(await requestGuardedScaleTare({ automatic: true, readState: () => state, refreshSettings: async () => { state.preparing = false }, sendTare: async () => { assert.fail('must not tare') } }), 'cancelled')
  state.preparing = true
  assert.equal(await requestGuardedScaleTare({ automatic: true, readState: () => state, refreshSettings: async () => {}, sendTare: async () => {} }), 'tared')
})
