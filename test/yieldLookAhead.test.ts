import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { hotWaterWeightStoppingPatch } from '../src/features/settings/yieldLookAhead.ts'
import { en } from '../src/i18n/en/index.ts'

test('scale connection enables weight stopping without overwriting either calibration', () => {
  for (const hotWaterFlowMultiplier of [0, 0.3, 0.7, 1]) {
    const settings = { weightFlowMultiplier: 1, hotWaterFlowMultiplier, stopHotWaterAtWeight: false }
    assert.deepEqual(hotWaterWeightStoppingPatch(settings), { stopHotWaterAtWeight: true })
    assert.deepEqual(hotWaterWeightStoppingPatch({ ...settings, stopHotWaterAtWeight: true }), {})
    assert.equal(settings.hotWaterFlowMultiplier, hotWaterFlowMultiplier)
  }
  assert.deepEqual(hotWaterWeightStoppingPatch({}), { stopHotWaterAtWeight: true })
})

test('settings save changes only requested fields and exposes independent hot-water calibration', () => {
  const save = readFileSync(new URL('../src/features/settings/useUnifiedSettings.ts', import.meta.url), 'utf8')
  assert.match(save, /const rea = changedFields\(baseline.rea, draft.rea\)/)
  assert.doesNotMatch(save, /hotWaterYieldLookAheadPatch|hotWaterFlowMultiplier/)
  const screen = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')
  assert.match(screen, /label=\{t\('settings\.prepare\.espressoYield'\)\}/)
  assert.match(screen, /label=\{t\('settings\.prepare\.hotWaterYield'\)\}/)
  assert.match(screen, /label=\{t\('settings\.prepare\.hotWaterYield'\)\}[^\n]*step=\{0\.05\} digits=\{2\}/)
  assert.match(screen, /patchRea\(\{ hotWaterFlowMultiplier \}\)/)
  assert.doesNotMatch(screen, /Reset hot-water calibration|patchRea\(\{ hotWaterFlowMultiplier: 0\.3 \}\)/)
  assert.match(screen, /label=\{t\('common\.metric\.volume'\)\} hint=\{t\('settings\.prepare\.volumeHint'\)\}/)
  assert.equal(en['settings.prepare.espressoYield'], 'Espresso')
  assert.equal(en['settings.prepare.hotWaterYield'], 'Hot water')
  assert.equal(en['settings.prepare.calibration.title'], 'Early-stop calibration')
  assert.equal(en['settings.prepare.calibration.description'], 'Compensates for liquid still reaching the cup after stopping. Higher values stop earlier.')
})
