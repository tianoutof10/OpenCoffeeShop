import assert from 'node:assert/strict'
import test from 'node:test'
import { setActiveLanguage } from '../src/i18n/index.ts'
import { analyseStageMoveOn, reconcileStageReasons, stageReasonKey, STAGE_REASON_VERSION } from '../src/features/brew/stageMoveOn.ts'
import { weightAdvanceEvidence, recordedStopReason } from '../src/features/brew/stageShotEvents.ts'
import { readStageEvidence, saveStageEvidence, withStageEvidence } from '../src/features/brew/stageEvidenceStorage.ts'
import { HistoryRepository } from '../src/features/insights/historyRepository.ts'
import { reconcileHistory, type HistoryCache } from '../src/features/insights/historyData.ts'
import type { DecaidProfileStep, ShotRecord } from '../src/api/decaid/types.ts'
import type { LiveShotPoint, PreviousShot } from '../src/domain/brewing.ts'

const points: LiveShotPoint[] = Array.from({ length: 11 }, (_, i) => ({ elapsedMs: i * 500, stageIndex: i < 10 ? 0 : 1, pressure: i < 8 ? 2 : 4, flow: 2, weight: i * 2 }))
const key = stageReasonKey(points[0])
const reason = (steps: DecaidProfileStep[], options: Parameters<typeof analyseStageMoveOn>[2] = {}) => analyseStageMoveOn(points, steps, options).reasons[key]
const step: DecaidProfileStep = { seconds: 30, exit: { type: 'pressure', condition: 'over', value: 4 } }
test('one sensor exit, time exit, flow-under and limiter distinction', () => {
  assert.equal(reason([step]).label, 'Pressure >4 bar reached')
  assert.equal(reason([{ seconds: 5, pressure: 2, limiter: { value: 2 } }]).label, 'Time limit reached')
  assert.equal(reason([{ exit: { type: 'flow', condition: 'under', value: 2 } }]).label, 'Flow <2 ml/s reached')
  assert.equal(reason([{ pressure: 4, flow: 2, limiter: { value: 4 } }]).label, 'Unknown')
})
test('all plausible causes use OR; inferred yield does not override others', () => {
  assert.equal(reason([{ ...step, seconds: 5, weight: 18, volume: 10 }]).label, 'Time limit reached or Pressure >4 bar reached or Stage yield reached or Stage volume reached')
  assert.equal(reason([{ ...step, weight: 20 }]).label, 'Pressure >4 bar reached') // no invented look-ahead
})
test('recorded weight/manual override inference only for a matched frame and boundary', () => {
  const evidence = [{ frame: 0, timestamp: 14500, reason: 'weight' as const }]
  assert.deepEqual(reason([step], { evidence, telemetryStartedAt: 10000 }), { conditions: [{ code: 'stageYield' }], label: 'Stage yield reached', source: 'recorded', kind: 'advance' })
  assert.equal(reason([step], { evidence: [...evidence, { frame: 0, timestamp: 14700, reason: 'manual' }], telemetryStartedAt: 10000 }).label, 'Stage yield reached or Manually advanced')
  for (const invalid of [{ frame: 1, timestamp: 14500 }, { frame: 0, timestamp: 15001 }, { frame: 0, timestamp: 10000 }]) {
    assert.equal(reason([step], { telemetryStartedAt: 10000, evidence: [{ ...invalid, reason: 'manual' }] }).source, 'telemetry')
  }
})
test('active stage has no reason; final stage uses whole-shot stop, not a move-on exit', () => {
  const lastKey = stageReasonKey(points.at(-1)!)
  assert.equal(analyseStageMoveOn(points, [step], { active: true }).reasons[lastKey], undefined)
  assert.deepEqual(analyseStageMoveOn(points, [step], { stopReason: 'targetWeight' }).reasons[lastKey], { conditions: [{ code: 'targetYield' }], label: 'Target yield reached', source: 'recorded', kind: 'stop' })
  assert.equal(analyseStageMoveOn(points, [step], { stopReason: 'machineEnded' }).reasons[lastKey].label, 'Unknown')
})
test('old gaps and forward jumps preserve departing-frame evidence but not arbitrary new-frame jumps', () => {
  assert.equal(reason([]).label, 'Unknown')
  const gap = [points[0], points.at(-2)!, points.at(-1)!]
  assert.equal(analyseStageMoveOn(gap, [step]).reasons[key].label, 'Pressure >4 bar reached')
  const jump = points.map(p => p.stageIndex === 1 ? { ...p, stageIndex: 3 } : p)
  assert.equal(analyseStageMoveOn(jump, [step]).reasons[key].label, 'Pressure >4 bar reached')
  const afterOnly = points.map(p => ({ ...p, pressure: p.stageIndex === 1 ? 4 : 2 }))
  assert.equal(analyseStageMoveOn(afterOnly, [step]).reasons[key].label, 'Unknown')
})
test('shot-state parsing distinguishes app weight advance from ordinary firmware advance', () => {
  const event = { event: 'decision', timestamp: '2026-09-16T01:00:00Z', decision: { kind: 'advance', reason: 'profileSkip', data: { frame: 2, stepExitWeight: 10 } } }
  assert.equal(weightAdvanceEvidence(event)?.reason, 'weight')
  assert.equal(weightAdvanceEvidence({ ...event, decision: { ...event.decision, reason: 'profileAdvance' } }), undefined)
  assert.equal(recordedStopReason(event), undefined)
  assert.equal(recordedStopReason({ ...event, decision: { kind: 'stop', reason: 'apiStop' } }), 'apiStop')
})
test('journal isolates gateways, deduplicates replay, and invalidates derived results', () => {
  saveStageEvidence('one', 'shot', { events: [{ frame: 0, timestamp: 500, reason: 'manual' }] })
  saveStageEvidence('one', 'shot', { events: [{ frame: 0, timestamp: 500, reason: 'manual' }] })
  assert.equal(readStageEvidence('one', 'shot')?.events.length, 1)
  assert.equal(readStageEvidence('two', 'shot'), undefined)
  const old = reconcileStageReasons({ profileName: 'Test', totalTime: '5', totalYield: '20', points })
  assert.equal(withStageEvidence(old, readStageEvidence('one', 'shot')).stageReasons, undefined)
})
test('cached graphs reconcile offline in batches; resume once, use saved recipe and defer summaries', async () => {
  const shots: ShotRecord[] = Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, timestamp: '2026-09-16T00:00:00Z', workflow: { profile: { steps: [step] } } }))
  const page = { items: shots, total: 9, offset: 0, limit: 100 }
  let saved: HistoryCache = reconcileHistory(page, null, 'local', 'UTC')
  const detail = (id: string): PreviousShot => ({ id, profileName: 'Old recipe', totalYield: '20', totalTime: '5', points })
  for (const raw of shots.slice(0, 8)) saved.details[raw.id!] = detail(raw.id!)
  // Simulate existing v0.1.30 analyses, including cached Unknown results.
  saved.details['0'].stageReasons = { version: 1, reasons: { [key]: { label: 'Unknown', source: 'unknown', kind: 'advance' } } }
  saved.details['1'].stageReasons = { version: 2, reasons: { [key]: { label: 'Pressure threshold reached', source: 'telemetry', kind: 'advance' } } }
  let requests = 0
  const create = () => new HistoryRepository('local', 'UTC', {
    storage: { read: async () => structuredClone(saved), write: async cache => { saved = structuredClone(cache) } },
    page: async () => { requests++; return page }, detail: async id => { requests++; return { ...shots.find(s => s.id === id), measurements: [] } }, toDetail: raw => detail(raw.id!),
  })
  const repo = create()
  assert.equal(await repo.reconcileStageReasonBatch(() => false), false)
  assert.equal(await repo.reconcileStageReasonBatch(), false)
  assert.equal(Object.values(saved.details).filter(d => d.stageReasons?.version === STAGE_REASON_VERSION).length, 5)
  const restarted = create()
  assert.equal(await restarted.reconcileStageReasonBatch(), true)
  assert.equal(Object.values(saved.details).filter(d => d.stageReasons?.version === STAGE_REASON_VERSION).length, 8)
  assert.equal(requests, 0)
  assert.equal(saved.details['0'].stageReasons?.reasons[key].label, 'Pressure >4 bar reached')
  assert.equal(saved.details['1'].stageReasons?.reasons[key].label, 'Pressure >4 bar reached')
  assert.equal(await restarted.reconcileStageReasonBatch(), true)
  assert.equal((await restarted.detail('8')).stageReasons?.reasons[key].label, 'Pressure >4 bar reached')
  assert.equal(requests, 1)
})
test('reason generation stays English regardless of the active display language (persisted evidence)', () => {
  setActiveLanguage('de', ['de-DE'])
  try {
    assert.equal(reason([step]).label, 'Pressure >4 bar reached')
    assert.equal(reason([{ seconds: 5, pressure: 2, limiter: { value: 2 } }]).label, 'Time limit reached')
  } finally {
    setActiveLanguage('en', ['en-US'])
  }
})
