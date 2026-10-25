import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { en } from '../src/i18n/en/index.ts'
import { languageRegistry, matchLanguage } from '../src/i18n/registry.ts'
import { activeLocaleTag, dateFormatter, decimalSeparator, formatDecimal, formatNumber, localeFor, parseLocalizedNumber, plural, resolveLanguage, setActiveLanguage, t } from '../src/i18n/index.ts'
import { insightHour, insightPeriods } from '../src/features/insights/insightClock.ts'
import { validateCatalog } from '../src/i18n/validation.ts'

const added = ['fr', 'it', 'zh-Hant', 'zh-Hans'] as const

test('contextual drafts complete approved terminology and preserve native date formatting', async () => {
  const provenance = JSON.parse(readFileSync(new URL('../docs/streamline-translation-provenance.json', import.meta.url), 'utf8'))
  const authored = JSON.parse(readFileSync(new URL('../docs/localisation-contextual-drafts.json', import.meta.url), 'utf8'))
  const pending = JSON.parse(readFileSync(new URL('../docs/localisation-pending.json', import.meta.url), 'utf8'))
  const formattingKeys = ['insights.period.dayMonth', 'insights.period.dayOnly']
  assert.deepEqual(authored.heldForClarification, [])
  assert.deepEqual(Object.keys(pending).sort(), [...formattingKeys].sort())
  for (const language of added) {
    const catalog = await languageRegistry[language].load()
    assert.deepEqual(validateCatalog(en, catalog, languageRegistry[language].locale), [])
    assert.equal(Object.keys(catalog).length, Object.keys(en).length - formattingKeys.length)
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value)
      const isAuthored = authored.entries[key]?.languages.includes(language)
      const entry = isAuthored ? authored.entries[key] : provenance.entries[key]
      assert.deepEqual(entry.english, en[key as keyof typeof en])
      assert.ok(entry.languages.includes(language))
      if (!isAuthored) assert.ok(entry.row > 1)
    }
    await setActiveLanguage(language, [])
    for (const key of [...authored.heldForClarification, ...formattingKeys]) {
      assert.equal(key in catalog, false, key)
      assert.equal(pending[key][language], '', key)
    }
    for (const key of ['settings.prepare.espressoYield', 'settings.prepare.hotWaterYield', 'builder.details.flowToleranceLabel', 'builder.details.pressureToleranceLabel', 'builder.details.limiterRangeHint', 'builder.validation.label.limiterResponseRange', 'builder.import.limiterRangeRequired'] as const) {
      assert.ok(key in catalog, key)
      assert.equal(t(key), catalog[key])
      assert.equal(key in pending, false)
    }
    for (const key of ['settings.advanced.gatewayMode.tracking', 'settings.advanced.gatewayMode.full', 'settings.purge.twoTap', 'shell.status.thirsty'] as const) {
      assert.ok(key in catalog)
      assert.notEqual(t(key), en[key])
      assert.equal(key in pending, false)
      assert.equal(authored.heldForClarification.includes(key), false)
    }
    assert.notEqual(t('library.field.source'), en['library.field.source'])
    assert.notEqual(t('brew.liveScreen.timerLabel'), en['brew.liveScreen.timerLabel'])
    assert.equal(t('brew.metric.yield'), t('insights.common.yield'))
    assert.equal(t('brew.metric.dose'), t('library.metric.dose'))
    assert.equal(t('brew.metric.flowRate'), t('common.metric.flow'))
    for (const count of [0, 1, 2, 1000000]) {
      const category = new Intl.PluralRules(languageRegistry[language].locale).select(count)
      const message = catalog['insights.common.brewsPct'] as Record<string, string>
      const expected = message[category].replace('{count}', formatNumber(count)).replace('{pct}', '50')
      assert.equal(plural('insights.common.brewsPct', count, { pct: 50 }), expected)
    }
    const reason = t('brew.stage.reason.sensorExitReached', { type: t('brew.metric.pressure'), symbol: '>', value: '7', unit: 'bar' })
    assert.ok(reason.includes('>7 bar'), reason)
    assert.ok(!reason.includes('{'), reason)
  }
  await setActiveLanguage('en', ['en-US'])
})

test('French and Italian status pills use compact labels while retaining full power guidance', async () => {
  const expected = {
    fr: { heating: 'chauffe', notHeating: 'Sans chauffe', sleeping: 'veille', disconnected: 'hors ligne', connecting: 'connexion', checkPowerButton: 'Vérifier marche/arrêt' },
    it: { heating: 'scalda', notHeating: 'Non scalda', sleeping: 'standby', disconnected: 'scollegata', connecting: 'connessione', checkPowerButton: 'Verifica accensione' },
  }
  for (const language of ['fr', 'it'] as const) {
    const catalog = await languageRegistry[language].load()
    for (const [status, label] of Object.entries(expected[language])) {
      assert.equal(catalog[`shell.status.${status}` as keyof typeof catalog], label)
    }
    assert.ok(String(catalog['shell.status.notHeatingTooltip']).length > expected[language].checkPowerButton.length)
  }
})

test('compact French and Italian settings navigation matches its page headings', async () => {
  const sections = {
    fr: { prepare: 'Boissons', clean: 'Entretien', devices: 'Appareils', power: 'Écran et veille', experience: 'Préférences', data: 'Données' },
    it: { prepare: 'Bevande', clean: 'Pulizia', devices: 'Dispositivi', power: 'Schermo e standby', experience: 'Preferenze' },
  }
  for (const language of ['fr', 'it'] as const) {
    const catalog = await languageRegistry[language].load()
    for (const [section, label] of Object.entries(sections[language])) {
      assert.equal(catalog[`settings.section.${section}.label` as keyof typeof catalog], label)
      assert.equal(catalog[`settings.section.${section}.title` as keyof typeof catalog], label)
      assert.ok(catalog[`settings.section.${section}.description` as keyof typeof catalog])
      assert.ok(catalog[`settings.section.${section}.keywords` as keyof typeof catalog])
    }
  }
})

test('Chinese script matching respects explicit script, regions and older WebViews', () => {
  const cases = { 'zh': 'zh-Hans', 'zh-CN': 'zh-Hans', 'zh-SG': 'zh-Hans', 'zh-TW': 'zh-Hant', 'zh-HK': 'zh-Hant', 'zh-MO': 'zh-Hant', 'zh-Hant-CN': 'zh-Hant', 'zh-Hans-TW': 'zh-Hans' } as const
  for (const [tag, code] of Object.entries(cases)) assert.equal(resolveLanguage('auto', [tag]), code)
  const original = Object.getOwnPropertyDescriptor(Intl, 'Locale')!
  try {
    Object.defineProperty(Intl, 'Locale', { configurable: true, value: undefined })
    for (const [tag, code] of Object.entries(cases)) assert.equal(matchLanguage(tag, languageRegistry), code)
    assert.equal(resolveLanguage('auto', ['fr-CA']), 'fr')
    assert.equal(resolveLanguage('auto', ['it-CH']), 'it')
  } finally { Object.defineProperty(Intl, 'Locale', original) }
  assert.equal(localeFor('fr', ['fr-CA']), 'fr-CA')
  assert.equal(localeFor('it', ['it-CH']), 'it-CH')
  assert.equal(localeFor('zh-Hant', ['zh-HK']), 'zh-HK')
  assert.equal(localeFor('zh-Hans', ['zh-SG']), 'zh-SG')
  assert.equal(localeFor('zh-Hant', ['zh-CN']), 'zh-TW')
})

test('regional number display and input do not alter numeric storage', async () => {
  const cases = [['fr', 'fr-FR'], ['fr', 'fr-CA'], ['it', 'it-IT'], ['it', 'it-CH'], ['zh-Hant', 'zh-TW'], ['zh-Hant', 'zh-HK'], ['zh-Hans', 'zh-CN'], ['zh-Hans', 'zh-SG']] as const
  for (const [language, locale] of cases) {
    await setActiveLanguage(language, [locale])
    assert.equal(activeLocaleTag(), locale)
    assert.equal(formatNumber(12345.6), new Intl.NumberFormat(locale).format(12345.6))
    const text = formatDecimal(18.5, 1)
    assert.equal(text, new Intl.NumberFormat(locale, { useGrouping: false, minimumFractionDigits: 1 }).format(18.5))
    assert.equal(parseLocalizedNumber(text), 18.5)
    assert.equal(JSON.stringify({ dose: parseLocalizedNumber(text) }), '{"dose":18.5}')
    assert.equal(decimalSeparator(), ['fr-FR', 'fr-CA', 'it-IT'].includes(locale) ? ',' : '.')
    assert.ok(Number.isNaN(parseLocalizedNumber('1,234.5')))
  }
  await setActiveLanguage('en', ['en-US'])
})

test('partial locales use native date ranges including cross-year and old-WebView fallback', async () => {
  const windows = [{ start: '2026-09-12', end: '2026-09-19' }, { start: '2026-09-05', end: '2026-09-12' }] as const
  for (const language of added) {
    await setActiveLanguage(language, [])
    const locale = languageRegistry[language].locale
    const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    assert.equal(insightPeriods(...windows)[0], formatter.formatRange(new Date('2026-09-12T12:00Z'), new Date('2026-09-18T12:00Z')))
    assert.equal(dateFormatter({ dateStyle: 'short', timeZone: 'UTC' }).format(new Date('2026-09-19T12:00Z')), new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(new Date('2026-09-19T12:00Z')))
    const crossYear = insightPeriods({ start: '2025-12-29', end: '2026-01-05' }, { start: '2025-12-22', end: '2025-12-29' })
    assert.match(crossYear[0], /2025/)
    assert.match(crossYear[0], /2026/)
    const original = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'formatRange')!
    try {
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', { configurable: true, value: undefined })
      assert.equal(insightPeriods(...windows)[0], `${formatter.format(new Date('2026-09-12T12:00Z'))}–${formatter.format(new Date('2026-09-18T12:00Z'))}`)
    } finally { Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', original) }
  }
  await setActiveLanguage('en', ['en-US'])
})

test('hour labels respect Chinese day-period order and independent clock preference', async () => {
  for (const language of added) {
    await setActiveLanguage(language, [])
    for (const hour of [0, 6, 12, 15, 18, 21]) {
      const expected = new Intl.DateTimeFormat(languageRegistry[language].locale, { hour: 'numeric', hourCycle: 'h12', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1, hour))).toLowerCase().replace(/[\u00a0\u202f]/g, ' ')
      assert.equal(insightHour(hour, '12h'), expected)
      assert.equal(insightHour(hour, '24h'), String(hour))
      assert.equal(insightHour(hour, '12h', true), String(hour % 12 || 12))
      assert.equal(insightHour(hour, 'device', false, 'en-US'), expected)
      assert.equal(insightHour(hour, 'device', false, 'en-GB'), String(hour))
    }
  }
  await setActiveLanguage('en', ['en-US'])
})
