import assert from 'node:assert/strict'
import test from 'node:test'
import { CHASSIS_LIMITS, chassisFromMetadata, chassisMetadata, clampChassis, compileChassisProfile, DEFAULT_CHASSIS } from '../src/domain/chassis.ts'
import { RESEARCH_PRESETS, isSoakStage } from '../src/domain/researchPresets.ts'
import { profileDraftFromDecaidProfile } from '../src/features/profiles/profileBuilderModel.ts'
import { validateProfileDraft } from '../src/features/profiles/profileBuilderValidation.ts'

test('every research preset is a valid Decent profile for the builder and import validators', () => {
  for (const preset of RESEARCH_PRESETS) {
    const draft = profileDraftFromDecaidProfile(preset.profile, { mode: 'import', copyName: false })
    assert.deepEqual(draft.importIssues ?? [], [], preset.id)
    assert.deepEqual(validateProfileDraft(draft).errors, [], preset.id)
    assert.equal(preset.profile.target_weight, preset.targetWeight)
    assert.ok(Math.abs(preset.targetWeight / preset.doseGrams - preset.ratio) < 0.1, `${preset.id} ratio`)
  }
})

test('presets carry the parameters from the brief', () => {
  const turbo = RESEARCH_PRESETS.find(preset => preset.id === 'turbo')!
  assert.equal(turbo.doseGrams, 15)
  assert.equal(turbo.profile.steps!.at(-1)!.pressure, 6)
  const blooming = RESEARCH_PRESETS.find(preset => preset.id === 'blooming')!
  assert.deepEqual(blooming.profile.steps!.map(step => [step.pump, step.flow ?? step.pressure, step.seconds]), [['flow', 4, 15], ['flow', 0, 30], ['flow', 2, 45]])
  assert.deepEqual(blooming.profile.steps![0].exit, { type: 'pressure', condition: 'over', value: 4 })
  const flowLed = RESEARCH_PRESETS.find(preset => preset.id === 'flowLed')!
  assert.equal(flowLed.profile.steps!.at(-1)!.flow, 1.8)
})

test('the adaptive chassis compiles its parameters into hydraulic exits and a pressure ceiling', () => {
  const profile = compileChassisProfile({ soakSeconds: 20, pressureCapBar: 7, flowTarget: 2.2, declineFlowDrop: 0.5, targetWeight: 42 })
  const [fill, soak, extraction, decline] = profile.steps!
  assert.deepEqual(fill.exit, { type: 'pressure', condition: 'over', value: DEFAULT_CHASSIS.fillExitBar })
  assert.equal(soak.flow, 0)
  assert.equal(soak.seconds, 20)
  assert.deepEqual(soak.exit, { type: 'pressure', condition: 'under', value: DEFAULT_CHASSIS.soakExitBar })
  assert.equal(extraction.flow, 2.2)
  assert.deepEqual(extraction.limiter, { value: 7, range: 0.6 })
  assert.equal(decline.flow, 1.7)
  assert.equal(decline.transition, 'smooth')
  assert.equal(profile.target_weight, 42)
  assert.deepEqual(validateProfileDraft(profileDraftFromDecaidProfile(profile, { mode: 'import', copyName: false })).errors, [])
})

test('chassis stages are omitted when soak or decline are zero, and values are clamped to safe ranges', () => {
  const steps = compileChassisProfile({ soakSeconds: 0, declineFlowDrop: 0 }).steps!
  assert.deepEqual(steps.map(step => step.name), ['Fill', 'Extraction'])
  const clamped = clampChassis({ pressureCapBar: 14, flowTarget: -2, soakSeconds: Number.NaN })
  assert.equal(clamped.pressureCapBar, CHASSIS_LIMITS.pressureCapBar[1])
  assert.equal(clamped.flowTarget, CHASSIS_LIMITS.flowTarget[0])
  assert.equal(clamped.soakSeconds, DEFAULT_CHASSIS.soakSeconds)
})

test('chassis parameters round-trip through profile metadata', () => {
  const params = clampChassis({ soakSeconds: 18, pressureCapBar: 7.5 })
  assert.deepEqual(chassisFromMetadata(chassisMetadata(params)), params)
  assert.equal(chassisFromMetadata({}), undefined)
})

test('soak stages are recognised by name or by a zero pump target', () => {
  assert.equal(isSoakStage({ stageName: 'Bloom' }), true)
  assert.equal(isSoakStage({ stageName: 'Extraction', targetFlow: 0, targetPressure: 0 }), true)
  assert.equal(isSoakStage({ stageName: 'Extraction', targetFlow: 2 }), false)
})
