import assert from 'node:assert/strict'
import test from 'node:test'
import type { LiveShotPoint } from '../src/domain/brewing.ts'
import { comparisonAlignment, controlledExperiment } from '../src/features/insights/shotComparison.ts'

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

test('next experiment changes one factor and preserves the rest of the recipe', () => {
  assert.equal(controlledExperiment.change, 'grind setting')
  assert.ok(controlledExperiment.keepConstant.includes('bean'))
  assert.match(controlledExperiment.instruction, /only the grind setting/)
  assert.doesNotMatch(controlledExperiment.instruction, /taste|setting automatically/i)
})
