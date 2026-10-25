import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { normalizeBestpressoPreferences, applyBestpressoPreferences } from '../src/features/settings/bestpressoPreferences.ts'

test('animations remain enabled for existing installations, and explicit opt-out survives normalization', () => {
  for (const value of [undefined, {}, { animationsEnabled: null }, { animationsEnabled: 'false' }]) {
    assert.equal(normalizeBestpressoPreferences(value).animationsEnabled, true)
  }
  const saved = JSON.parse(JSON.stringify(normalizeBestpressoPreferences({ animationsEnabled: false, theme: 'light' })))
  assert.equal(normalizeBestpressoPreferences(saved).animationsEnabled, false)
  assert.equal(normalizeBestpressoPreferences(saved).theme, 'light')
})

test('applying preferences enables the static rendering path before the app mounts', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const dataset: Record<string, string> = {}
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset }, querySelector: () => null } })
  try {
    applyBestpressoPreferences(normalizeBestpressoPreferences({ animationsEnabled: false }))
    assert.equal(dataset.animations, 'off')
    applyBestpressoPreferences(normalizeBestpressoPreferences({ animationsEnabled: true }))
    assert.equal(dataset.animations, 'on')
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})

test('resource-saving mode removes orbit layers and interpolation without disabling operational loaders', () => {
  const css = readFileSync(new URL('../src/styles/homeAnimations.css', import.meta.url), 'utf8')
  assert.match(css, /content:none/)
  assert.match(css, /will-change:auto/)
  assert.match(css, /transition:none/)
  assert.doesNotMatch(css, /animation-play-state|live-brew-stage__loader|stop-request/)
  const source = readFileSync(new URL('../src/features/machine/TemperatureReading.tsx', import.meta.url), 'utf8')
  assert.match(source, /return animate \? <AnimatedTemperatureReading value=\{value\} \/> : <span className="temperature-digits">\{value\}<\/span>/)
})
