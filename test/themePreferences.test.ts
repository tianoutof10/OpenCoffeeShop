import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyBestpressoPreferences, BESTPRESSO_PREFERENCES_KEY, normalizeBestpressoPreferences, readBestpressoPreferences, writeBestpressoPreferences } from '../src/features/settings/bestpressoPreferences.ts'

test('new and invalid preferences use the warm Nordic theme; dark and light are explicit choices, and light is never automatic', () => {
  for (const value of [undefined, null, {}, { theme: 'system' }, { theme: 'LIGHT' }, { theme: false }, { clockFormat: '24h' }]) {
    assert.equal(normalizeBestpressoPreferences(value).theme, 'nordic')
  }
  assert.equal(normalizeBestpressoPreferences({ theme: 'light' }).theme, 'light')
  assert.equal(normalizeBestpressoPreferences({ theme: 'dark' }).theme, 'dark')
  assert.equal(normalizeBestpressoPreferences({ theme: 'nordic' }).theme, 'nordic')
})

test('explicit light and dark choices persist and unrelated saves preserve the chosen theme', (t) => {
  const storage = new Map<string, string>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const dataset: Record<string, string> = {}
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    dispatchEvent: () => true,
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset }, querySelector: () => null } })
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  applyBestpressoPreferences()
  assert.equal(dataset.theme, 'nordic')
  writeBestpressoPreferences({ theme: 'light' })
  assert.equal(dataset.theme, 'light')
  assert.equal(readBestpressoPreferences().theme, 'light')
  writeBestpressoPreferences({ clockFormat: '24h' })
  assert.equal(JSON.parse(storage.get(BESTPRESSO_PREFERENCES_KEY)!).theme, 'light')
  applyBestpressoPreferences(readBestpressoPreferences())
  assert.equal(dataset.theme, 'light')
  writeBestpressoPreferences({ theme: 'dark' })
  assert.equal(readBestpressoPreferences().theme, 'dark')
  assert.equal(dataset.theme, 'dark')
  storage.set(BESTPRESSO_PREFERENCES_KEY, '{invalid json')
  assert.equal(readBestpressoPreferences().theme, 'nordic')
})

test('appearance selector labels light as beta and does not depend on the Decaid theme', () => {
  const screen = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const en = readFileSync(new URL('../src/i18n/en/settings.ts', import.meta.url), 'utf8')
  assert.match(screen, /label=\{t\('settings\.experience\.bestpressoTheme'\)\}[^>]+value=\{preferences.theme\}/)
  assert.match(screen, /label: t\('settings\.theme\.lightBeta'\)/)
  assert.match(en, /'settings\.theme\.lightBeta': 'Light \(Beta\)'/)
  assert.match(screen, /label=\{t\('settings\.experience\.decaidTheme'\)\}/)
  assert.doesNotMatch(app, /get\('theme'\)/)
})

test('the Nordic layer loads after the base styles, and its generated accent map is current', async () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const order = ['./styles/index.css', './styles/lightMode.css', './styles/nordicAccents.css', './styles/nordic.css'].map(path => app.indexOf(`import '${path}'`))
  assert.ok(order.every(index => index >= 0) && order.every((index, i) => i === 0 || index > order[i - 1]), 'nordic styles load last')
  const { execFileSync } = await import('node:child_process')
  const before = readFileSync(new URL('../src/styles/nordicAccents.css', import.meta.url), 'utf8')
  execFileSync(process.execPath, [new URL('../scripts/nordic-accents.mjs', import.meta.url).pathname])
  assert.equal(readFileSync(new URL('../src/styles/nordicAccents.css', import.meta.url), 'utf8'), before, 'run node scripts/nordic-accents.mjs after changing base styles')
})
