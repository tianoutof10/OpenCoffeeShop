import assert from 'node:assert/strict'
import test from 'node:test'
import type { LiveShotPoint } from '../src/domain/brewing.ts'
import { comparisonAlignment, controlledExperiment, phaseSummaries } from '../src/features/insights/shotComparison.ts'

const trace = (stages: Array<[number, string, number[]]>): LiveShotPoint[] => stages.flatMap(([stageIndex, stageName, times]) => times.map(elapsedMs => ({ elapsedMs, stageIndex, stageName, pressure: 6 })))

test('phase alignment uses matching phase boundaries recorded in both telemetry traces', () => {
  const a = trace([[0, 'Pre-infusion', [0, 10]], [1, 'Pouring', [20, 40]]])
  const b = trace([[0, 'Pre-infusion', [0, 30]], [1, 'Pouring', [60, 120]]])
  const alignment = comparisonAlignment(a, b)
  assert.equal(alignment.kind, 'phases')
  assert.deepEqual(alignment.kind === 'phases' ? alignment.phases : [], ['pre-infusion', 'pouring'])
  assert.equal(alignment.position(a[1], a), 0.5)
  assert.equal(alignment.position(b[1], b), 0.5)
  assert.equal(alignment.position(a[2], a), 0.5)
})

test('phase alignment falls back to elapsed time if either trace lacks phase telemetry', () => {
  const recorded = trace([[0, 'Pre-infusion', [0, 10]], [1, 'Pouring', [20, 40]]])
  const unmarked: LiveShotPoint[] = [{ elapsedMs: 0, stageIndex: 0, stageName: 'Pre-infusion' }, { elapsedMs: 40 }, { elapsedMs: 80, stageIndex: 1, stageName: 'Pouring' }]
  const alignment = comparisonAlignment(recorded, unmarked)
  assert.equal(alignment.kind, 'elapsed')
  assert.equal(alignment.position(unmarked[2], unmarked), 1)
})

test('phase alignment falls back when the recorded phase sequences differ', () => {
  const a = trace([[0, 'Pre-infusion', [0, 10]], [1, 'Pouring', [20, 40]]])
  const b = trace([[0, 'Pre-infusion', [0, 10]], [2, 'Finishing', [20, 40]]])
  assert.equal(comparisonAlignment(a, b).kind, 'elapsed')
})

test('phase summaries report sample means, durations, and per-sensor coverage without filling gaps', () => {
  const a: LiveShotPoint[] = [
    { elapsedMs: 0, stageIndex: 0, stageName: 'Pre-infusion', pressure: 2, flow: 1 },
    { elapsedMs: 1000, stageIndex: 0, stageName: 'Pre-infusion', pressure: 4, flow: 3 },
    { elapsedMs: 1000, stageIndex: 1, stageName: 'Pouring', pressure: 8, flow: 2 },
    { elapsedMs: 3000, stageIndex: 1, stageName: 'Pouring', pressure: 6, flow: 4 },
  ]
  const b: LiveShotPoint[] = [
    { elapsedMs: 0, stageIndex: 0, stageName: 'Pre-infusion', pressure: 3 },
    { elapsedMs: 2000, stageIndex: 0, stageName: 'Pre-infusion', pressure: 5 },
    { elapsedMs: 2000, stageIndex: 1, stageName: 'Pouring', pressure: 7, flow: 6 },
    { elapsedMs: 5000, stageIndex: 1, stageName: 'Pouring', pressure: 9, flow: 8 },
  ]
  const summary = phaseSummaries(a, b)
  assert.ok(summary)
  assert.deepEqual(summary[0], {
    name: 'pre-infusion',
    a: { durationMs: 1000, pressure: 3, flow: 2, pressureSamples: 2, flowSamples: 2 },
    b: { durationMs: 2000, pressure: 4, flow: null, pressureSamples: 2, flowSamples: 0 },
  })
  assert.equal(summary[1].a.durationMs, 2000)
  assert.equal(summary[1].b.flow, 7)
})

test('next experiment changes one factor and preserves the rest of the recipe', () => {
  assert.equal(controlledExperiment.change, 'grind setting')
  assert.ok(controlledExperiment.keepConstant.includes('bean'))
  assert.match(controlledExperiment.instruction, /only the grind setting/)
  assert.doesNotMatch(controlledExperiment.instruction, /taste|setting automatically/i)
})
