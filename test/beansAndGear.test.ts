import assert from 'node:assert/strict'
import test from 'node:test'
import { beanFromProductPage, daysOffRoast, parseBeanText, parseLabelDate, processFamily, productFetchCandidates, startingRecipe, type Bean } from '../src/domain/beans.ts'
import { analysisOverridesForGear, DEFAULT_GEAR, nextGrindSetting, normalizeGear } from '../src/domain/gear.ts'

const now = new Date(2026, 9, 24)
const bean = (patch: Partial<Bean> = {}): Bean => ({ id: 'b', name: 'Test', tastingNotes: [], createdAt: '2026-10-01', ...patch })

test('days off roast counts calendar days and ignores invalid or future dates', () => {
  assert.equal(daysOffRoast(bean({ roastDate: '2026-10-20' }), now), 4)
  assert.equal(daysOffRoast(bean({ roastDate: '2026-10-30' }), now), undefined)
  assert.equal(daysOffRoast(bean({ roastDate: 'last week' }), now), undefined)
})

test('label dates parse common roaster formats, US month-first unless unambiguous', () => {
  assert.equal(parseLabelDate('2026-10-12'), '2026-10-12')
  assert.equal(parseLabelDate('10/12/26'), '2026-10-12')
  assert.equal(parseLabelDate('10/12/26', 'dmy'), '2026-12-10')
  assert.equal(parseLabelDate('24.10.2026'), '2026-10-24')
  assert.equal(parseLabelDate('12 Oct 2026'), '2026-10-12')
  assert.equal(parseLabelDate('October 12th, 2026'), '2026-10-12')
  assert.equal(parseLabelDate('no date here'), undefined)
})

test('label text maps to bean fields without inventing values', () => {
  const draft = parseBeanText('ETHIOPIA GUJI\nProducer: Hambela Washing Station\nVariety: Heirloom\nProcess: Washed\n1,950 - 2,200 masl\nTasting notes: jasmine, bergamot & peach\nRoasted on 10/14/2026\nLight roast')
  assert.equal(draft.name, 'ETHIOPIA GUJI')
  assert.equal(draft.origin, 'Ethiopia')
  assert.equal(draft.producer, 'Hambela Washing Station')
  assert.equal(draft.variety, 'Heirloom')
  assert.equal(draft.process, 'Washed')
  assert.equal(draft.altitudeMasl, 2075)
  assert.deepEqual(draft.tastingNotes, ['jasmine', 'bergamot', 'peach'])
  assert.equal(draft.roastDate, '2026-10-14')
  assert.equal(draft.roastLevel, 'light')
  const sparse = parseBeanText('House blend')
  assert.equal(sparse.origin, undefined)
  assert.equal(sparse.roastDate, undefined)
  assert.equal(sparse.process, undefined)
})

test('process families group fermentation styles', () => {
  assert.equal(processFamily('Anaerobic Natural'), 'anaerobic')
  assert.equal(processFamily('Black Honey'), 'honey')
  assert.equal(processFamily('Natural'), 'natural')
  assert.equal(processFamily('Fully washed'), 'washed')
  assert.equal(processFamily(undefined), undefined)
})

test('roaster pages import from JSON-LD products and Shopify product JSON', () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Kenya Kiambu AA","brand":{"@type":"Brand","name":"Example Roasters"},"description":"<p>Process: Washed<br>Variety: SL28, SL34</p><p>Tasting notes: blackcurrant, grapefruit</p>","additionalProperty":[{"name":"Altitude","value":"1,800 m"}]}]}</script></html>`
  const fromLd = beanFromProductPage(html, 'https://example.com/products/kiambu')!
  assert.equal(fromLd.name, 'Kenya Kiambu AA')
  assert.equal(fromLd.roaster, 'Example Roasters')
  assert.equal(fromLd.process, 'Washed')
  assert.equal(fromLd.variety, 'SL28, SL34')
  assert.equal(fromLd.altitudeMasl, 1800)
  assert.equal(fromLd.origin, 'Kenya')
  const shopify = beanFromProductPage(JSON.stringify({ title: 'Colombia Pink Bourbon', vendor: 'Shop Roasters', description: '<p>Notes: strawberry, cacao</p>', tags: ['Process_Anaerobic Natural', 'Light'] }))!
  assert.equal(shopify.roaster, 'Shop Roasters')
  assert.equal(shopify.process, 'Anaerobic Natural')
  assert.equal(shopify.origin, 'Colombia')
  assert.deepEqual(shopify.tastingNotes, ['strawberry', 'cacao'])
  assert.equal(beanFromProductPage('<html>nothing</html>'), undefined)
})

test('Shopify product URLs are tried as structured JSON first', () => {
  assert.deepEqual(productFetchCandidates('https://shop.example/products/guji/'), ['https://shop.example/products/guji.js', 'https://shop.example/products/guji.json', 'https://shop.example/products/guji/'])
  assert.deepEqual(productFetchCandidates('not a url'), [])
})

test('starting recipes follow roast level, age, process, burrs, basket, water and style, with reasons', () => {
  const light = startingRecipe(bean({ roastLevel: 'light', roastDate: '2026-10-20', altitudeMasl: 2000, process: 'Washed' }), { ...DEFAULT_GEAR, burrs: 'unimodalFlat' }, 18, now)
  assert.equal(light.params.temperatureC, 94)
  assert.equal(light.ratio, 2.5)
  assert.equal(light.params.targetWeight, 45)
  assert.equal(light.params.soakSeconds, 20)
  assert.ok(light.reasons.includes('freshRoast') && light.reasons.includes('unimodalBurrs') && light.reasons.includes('highGrown'))

  const dark = startingRecipe(bean({ roastLevel: 'dark', process: 'Natural' }), { ...DEFAULT_GEAR, style: 'body', burrs: 'conical', waterAlkalinityPpm: 120 }, 18, now)
  assert.equal(dark.params.temperatureC, 88.5)
  assert.ok(dark.params.pressureCapBar <= 8)
  assert.ok(dark.ratio <= 1.9)
  assert.ok(dark.reasons.includes('hardWater') && dark.reasons.includes('fermentedProcess') && dark.reasons.includes('conicalBurrs'))

  assert.ok(startingRecipe(bean({ roastDate: '2026-10-22' }), DEFAULT_GEAR, 18, now).reasons.includes('veryFreshRoast'))
  const basket = startingRecipe(undefined, { ...DEFAULT_GEAR, basket: 'highExtraction' }, 18, now)
  assert.equal(basket.params.flowTarget, 2.5)
})

test('gear adjusts analysis thresholds and grinder-native steps', () => {
  assert.deepEqual(analysisOverridesForGear({ ...DEFAULT_GEAR }), {})
  assert.equal(analysisOverridesForGear({ ...DEFAULT_GEAR, bottomPaperFilter: true }).suddenDropFraction, 0.45)
  assert.equal(nextGrindSetting('12', -1, { ...DEFAULT_GEAR, grindStepSize: 0.5 }), 11.5)
  assert.equal(nextGrindSetting('2.4', 1, { ...DEFAULT_GEAR, grindStepSize: 1 }), 3.4)
  assert.equal(nextGrindSetting('—', 1, DEFAULT_GEAR), undefined)
  assert.equal(normalizeGear({ burrs: 'laser', style: 'body', waterAlkalinityPpm: -4 }).burrs, undefined)
  assert.equal(normalizeGear({ style: 'body' }).style, 'body')
})

test('roaster import tries structured product JSON first and reports blocked pages', async () => {
  const { importBeanFromUrl, BeanImportError } = await import('../src/features/beans/webImport.ts')
  const tried: string[] = []
  const fetcher = (async (url: string) => {
    tried.push(url)
    if (url.endsWith('.js')) return new Response(JSON.stringify({ title: 'Guji Hambela', vendor: 'Example', description: 'Process: Natural' }), { status: 200 })
    return new Response('', { status: 404 })
  }) as unknown as typeof fetch
  const draft = await importBeanFromUrl('https://shop.example/products/guji', fetcher)
  assert.equal(draft.name, 'Guji Hambela')
  assert.equal(draft.process, 'Natural')
  assert.deepEqual(tried, ['https://shop.example/products/guji.js'])
  const blocked = (async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
  await assert.rejects(importBeanFromUrl('https://shop.example/products/guji', blocked), (error: unknown) => error instanceof BeanImportError && error.reason === 'blocked')
  await assert.rejects(importBeanFromUrl('nope', blocked), (error: unknown) => error instanceof BeanImportError && error.reason === 'invalidUrl')
})
