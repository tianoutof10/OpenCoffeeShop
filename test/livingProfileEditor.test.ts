import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const screen = readFileSync(new URL('../src/features/beans/CoffeeScreen.tsx', import.meta.url), 'utf8')

test('Living Profile exposes the three bounded recipe controls and an explicit apply action', () => {
  for (const key of ['flowTarget', 'pressureCapBar', 'temperatureC']) {
    assert.match(screen, new RegExp(`key: '${key}'`))
    assert.match(screen, /type="range" min=\{min\} max=\{max\} step="0\.1"/)
  }
  assert.match(screen, /disabled=\{!connected \|\| applyState === 'applying' \|\| applyState === 'applied'\}/)
  assert.match(screen, /onClick=\{\(\) => void apply\(\)\}/)
  assert.match(screen, /onApplyStartingRecipe\(params\)/)
})

test('the slider draft respects chassis limits and is not written on slider change', () => {
  assert.match(screen, /const \[min, max\] = CHASSIS_LIMITS\[key\]/)
  assert.match(screen, /setParams\(current => clampChassis\(\{ \.\.\.current, \[key\]: value \}\)\)/)
  const change = screen.slice(screen.indexOf('const change ='), screen.indexOf('const apply ='))
  assert.doesNotMatch(change, /onApplyStartingRecipe|updateProfile|saveProfile/)
})
