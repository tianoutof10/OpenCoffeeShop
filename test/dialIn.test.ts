import assert from 'node:assert/strict'
import test from 'node:test'
import type { ShotAnalysis, ShotFinding } from '../src/domain/shotAnalysis.ts'
import { clampChassis } from '../src/domain/chassis.ts'
import { DEFAULT_GEAR } from '../src/domain/gear.ts'
import { adviceApplyAction, extractionYieldPct, isOnTarget, measuredPoint, palateDisagrees, recommendNextShot, type TasteNote } from '../src/features/insights/dialIn.ts'

const clean: Pick<ShotAnalysis, 'analysable' | 'findings'> = { analysable: true, findings: [] }
const drop: ShotFinding = { kind: 'suddenResistanceDrop', atMs: 8_000, dropFraction: 0.5, fromResistance: 2, toResistance: 1, severity: 'strong', phase: 'early' }
const choke: ShotFinding = { kind: 'chokedFlow', atMs: 8_000, durationMs: 12_000, meanPressure: 9, meanFlow: 0.4 }
const withFinding = (finding: ShotFinding) => ({ analysable: true, findings: [finding] })
const context = { dose: 18, yield: 36, grindSetting: '12', temperatureC: 93, peakPressureBar: 9 }
const note = (extraction: number, strength: number, finish: TasteNote['finish'] = 'clean', milk = false): TasteNote => ({ extraction, strength, finish, milk })
const SOUR = -0.7, BITTER = 0.7, WEAK = -0.7, STRONG = 0.7

test('the centre of the square, clean, is dialed in; even a telemetry finding does not override the cup', () => {
  assert.equal(recommendNextShot(note(0.1, -0.1), clean, context).reason, 'dialedIn')
  assert.equal(recommendNextShot(note(0, 0), withFinding(drop), context).primary.kind, 'keep')
  assert.equal(isOnTarget(note(0, 0, 'drying')), false)
})

test('sour and it ran fast: grind finer, not more water', () => {
  const advice = recommendNextShot(note(SOUR, 0), clean, { ...context, pace: 'fast', gear: { ...DEFAULT_GEAR, grindStepSize: 0.5 } })
  assert.equal(advice.reason, 'sourFast')
  assert.deepEqual(advice.primary, { kind: 'grindFiner', grindSetting: '12', toSetting: 11.5, apply: { kind: 'profileSettings', changes: [{ setting: 'grindSetting', value: 11.5 }] } })
  assert.equal(advice.basis, 'both')
})

test('sour at a normal pace stretches the ratio by 0.3 and offers Turbo at 9 bar', () => {
  const advice = recommendNextShot(note(SOUR, 0), clean, { ...context, pace: 'normal' })
  assert.deepEqual(advice.primary, { kind: 'longerYield', fromGrams: 36, toGrams: 41, toRatio: 2.3, apply: { kind: 'profileSettings', changes: [{ setting: 'targetYield', value: 41 }] } })
  assert.equal(advice.reason, 'sour')
  assert.deepEqual(advice.alternative, { kind: 'tryTurbo' })
  assert.equal(recommendNextShot(note(SOUR, STRONG), clean, context).reason, 'sourStrong')
})

test('sour and strong gets different advice from sour and thin', () => {
  const strong = recommendNextShot(note(SOUR, STRONG), clean, context)
  const thin = recommendNextShot(note(SOUR, WEAK), clean, context)
  assert.equal(strong.primary.kind, 'longerYield')
  assert.equal(thin.primary.kind, 'grindFiner')
  assert.equal(thin.reason, 'sourWeak')
})

test('sour and thin on a shot that already crawled warms or soaks instead of grinding finer', () => {
  assert.equal(recommendNextShot(note(SOUR, WEAK), clean, { ...context, pace: 'slow' }).primary.kind, 'warmer')
  const chassis = clampChassis({ soakSeconds: 10 })
  const soak = recommendNextShot(note(SOUR, WEAK), clean, { ...context, pace: 'slow', chassis })
  assert.deepEqual(adviceApplyAction(soak), { kind: 'chassis', params: { ...chassis, soakSeconds: 15 } })
})

test('sour on a long ratio warms the brew (or lengthens the Living Profile soak)', () => {
  assert.equal(recommendNextShot(note(SOUR, 0), clean, { ...context, yield: 48 }).reason, 'sourLongRatio')
  assert.equal(recommendNextShot(note(SOUR, 0), clean, { ...context, yield: 48 }).primary.kind, 'warmer')
})

test('a Traditional Body style resolves sourness with temperature', () => {
  const advice = recommendNextShot(note(SOUR, 0), clean, { ...context, gear: { ...DEFAULT_GEAR, style: 'body' } })
  assert.deepEqual(advice.primary, { kind: 'warmer', fromC: 93, toC: 94.5, apply: { kind: 'profileSettings', changes: [{ setting: 'temperature', value: 94.5 }] } })
})

test('bitter: slow or strong coarsens; otherwise the ratio shortens by 0.2', () => {
  assert.equal(recommendNextShot(note(BITTER, 0), clean, { ...context, pace: 'slow' }).reason, 'bitterSlow')
  assert.equal(recommendNextShot(note(BITTER, STRONG), clean, context).primary.kind, 'grindCoarser')
  const advice = recommendNextShot(note(BITTER, 0), clean, context)
  assert.equal(advice.primary.kind, 'shorterYield')
  if (advice.primary.kind === 'shorterYield') assert.equal(advice.primary.toGrams, 32)
  assert.equal(recommendNextShot(note(BITTER, WEAK), clean, context).reason, 'bitterWeak')
  assert.equal(recommendNextShot(note(BITTER, 0), clean, { ...context, yield: 30 }).reason, 'bitterShortRatio')
})

test('weak but balanced adds dose at the same ratio; a full basket shortens the ratio instead', () => {
  assert.deepEqual(recommendNextShot(note(0, WEAK), clean, context).primary, { kind: 'moreDose', fromGrams: 18, toGrams: 19, toYieldGrams: 38, apply: { kind: 'profileSettings', changes: [{ setting: 'dose', value: 19 }, { setting: 'targetYield', value: 38 }] } })
  assert.equal(recommendNextShot(note(0, WEAK), clean, { ...context, gear: { ...DEFAULT_GEAR, basketDoseGrams: 18 } }).reason, 'weakBasketFull')
  assert.deepEqual(recommendNextShot(note(0, WEAK), clean, { ...context, gear: { ...DEFAULT_GEAR, waterAlkalinityPpm: 120 } }).alternative, { kind: 'checkWater', ppm: 120 })
})

test('with a fixed dose, a thin cup shortens the ratio instead of adding coffee', () => {
  const advice = recommendNextShot(note(0, WEAK), clean, { ...context, gear: { ...DEFAULT_GEAR, fixedDose: true } })
  assert.equal(advice.reason, 'weakFixedDose')
  assert.equal(advice.primary.kind, 'shorterYield')
})

test('strong but balanced lengthens the ratio', () => {
  assert.equal(recommendNextShot(note(0, STRONG), clean, context).reason, 'strong')
})

test('milk moves the target up: a strong shot for milk is on target, a balanced one is weak', () => {
  assert.equal(recommendNextShot(note(0, 0.3, 'clean', true), clean, context).reason, 'dialedIn')
  assert.equal(recommendNextShot(note(0, -0.1, 'clean', true), clean, context).reason, 'weak')
  assert.equal(recommendNextShot(note(0, -0.1, 'clean', true), clean, context).milk, true)
})

test('near the target, or when taste and pace disagree, the advice is tentative', () => {
  assert.equal(recommendNextShot(note(-0.35, 0), clean, context).confidence, 'tentative')
  assert.equal(recommendNextShot(note(SOUR, 0), clean, { ...context, pace: 'slow' }).confidence, 'tentative')
  assert.equal(recommendNextShot(note(SOUR, 0), clean, { ...context, pace: 'normal' }).confidence, 'clear')
})

test('a channel with an off cup puts puck prep first; on very fresh coffee it names the gas and offers a longer soak', () => {
  const advice = recommendNextShot(note(SOUR, WEAK), withFinding(drop), context)
  assert.equal(advice.primary.kind, 'puckPrep')
  assert.equal(advice.secondary?.kind, 'grindFiner')
  const chassis = clampChassis({ soakSeconds: 8 })
  const fresh = recommendNextShot(note(SOUR, 0), withFinding(drop), { ...context, rest: 'tooFresh', chassis })
  assert.equal(fresh.reason, 'puckDropFresh')
  assert.equal(fresh.alternative?.kind, 'longerSoak')
})

test('stalled flow coarsens first and keeps a non-grind taste step second', () => {
  const advice = recommendNextShot(note(SOUR, 0), withFinding(choke), { ...context, gear: { ...DEFAULT_GEAR, grindStepSize: 0.5, grindUnit: 'mark' } })
  assert.deepEqual(advice.primary, { kind: 'grindCoarser', grindSetting: '12', toSetting: 12.5, unit: 'mark', apply: { kind: 'profileSettings', changes: [{ setting: 'grindSetting', value: 12.5 }] } })
  assert.equal(advice.secondary?.kind, 'longerYield')
})

test('a drying finish at high pressure lowers the ceiling to 6 bar (applied to the Living Profile when used)', () => {
  assert.deepEqual(recommendNextShot(note(0, 0, 'drying'), clean, context).primary, { kind: 'lowerPeakPressure', fromBar: 9, toBar: 6 })
  const chassis = clampChassis({ pressureCapBar: 8 })
  assert.deepEqual(adviceApplyAction(recommendNextShot(note(0, 0, 'drying'), clean, { ...context, chassis })), { kind: 'chassis', params: { ...chassis, pressureCapBar: 6 } })
  assert.equal(recommendNextShot(note(0, 0, 'drying'), clean, { ...context, peakPressureBar: 6 }).reason, 'astringentLowPressure')
})

test('Living Profile yield changes update the chassis target', () => {
  const chassis = clampChassis({ targetWeight: 36 })
  assert.deepEqual(adviceApplyAction(recommendNextShot(note(SOUR, 0), clean, { ...context, chassis })), { kind: 'chassis', params: { ...chassis, targetWeight: 41 } })
})

test('advice still works without recipe or telemetry, but offers nothing to apply', () => {
  const advice = recommendNextShot(note(SOUR, 0), undefined)
  assert.deepEqual(advice.primary, { kind: 'longerYield' })
  assert.equal(advice.basis, 'taste')
  assert.equal(adviceApplyAction(advice), undefined)
})

test('refractometer: extraction yield and its place on the square; big gaps from the palate are flagged', () => {
  assert.equal(extractionYieldPct(9.5, 38, 18), 20.1)
  assert.equal(extractionYieldPct(undefined, 38, 18), undefined)
  const point = measuredPoint(10, 16)
  assert.deepEqual(point, { extraction: -1, strength: 0 })
  assert.equal(palateDisagrees({ extraction: 0.6, strength: 0 }, point), true)
  assert.equal(palateDisagrees({ extraction: -0.8, strength: 0.1 }, point), false)
})
