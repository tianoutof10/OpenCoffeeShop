import { useEffect, useState } from 'react'
import type { TemperatureUnit } from '../../domain/temperature'
import { isLanguage, resolveLanguage, setActiveLanguage, type LanguagePreference } from '../../i18n/index.ts'
import type { ClockFormat } from '../sleep/deviceTime'

export type ChartLineWeight = 'fine' | 'standard' | 'bold'
/** Live-pull layout: full telemetry chart, or the calm yield ring. */
export type LiveView = 'chart' | 'calm'
/** Home: today's coffee and recipe, or the full machine dashboard. */
export type HomeView = 'today' | 'machine'

export interface BestpressoPreferences {
  theme: 'nordic' | 'dark' | 'light'
  completionSoundEnabled: boolean
  animationsEnabled: boolean
  waterWarningLevelMl: number
  waterCriticalLevelMl: number
  chartLineWeight: ChartLineWeight
  temperatureUnit: TemperatureUnit
  clockFormat: ClockFormat
  screensaverBrightness: number
  screensaverScreenOffDelaySeconds: number
  language: LanguagePreference
  liveView: LiveView
  homeView: HomeView
}

export const BESTPRESSO_PREFERENCES_KEY = 'bestpresso.preferences.v1'
const preferenceEvent = 'bestpresso:preferences-changed'

export const DEFAULT_BESTPRESSO_PREFERENCES: BestpressoPreferences = {
  theme: 'nordic',
  completionSoundEnabled: true,
  animationsEnabled: true,
  waterWarningLevelMl: 426,
  waterCriticalLevelMl: 300,
  chartLineWeight: 'fine',
  temperatureUnit: 'C',
  clockFormat: 'device',
  screensaverBrightness: 7,
  screensaverScreenOffDelaySeconds: 0,
  language: 'auto',
  liveView: 'calm',
  homeView: 'today',
}

const finiteRange = (value: unknown, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(2_000, number))) : fallback
}

export function normalizeBestpressoPreferences(value: unknown): BestpressoPreferences {
  const candidate = value && typeof value === 'object' ? value as Partial<BestpressoPreferences> : {}
  const critical = finiteRange(candidate.waterCriticalLevelMl, DEFAULT_BESTPRESSO_PREFERENCES.waterCriticalLevelMl)
  const warning = Math.max(critical + 1, finiteRange(candidate.waterWarningLevelMl, DEFAULT_BESTPRESSO_PREFERENCES.waterWarningLevelMl))
  const chartLineWeight = candidate.chartLineWeight === 'standard' || candidate.chartLineWeight === 'bold'
    ? candidate.chartLineWeight
    : 'fine'
  const temperatureUnit = candidate.temperatureUnit === 'F' ? 'F' : 'C'
  return {
    // Nordic (warm dark) is the default; Dark and Light (Beta) remain explicit choices.
    // Light stays opt-in: device appearance never enables it.
    theme: candidate.theme === 'light' ? 'light' : candidate.theme === 'dark' ? 'dark' : 'nordic',
    completionSoundEnabled: candidate.completionSoundEnabled !== false,
    animationsEnabled: candidate.animationsEnabled !== false,
    screensaverBrightness: typeof candidate.screensaverBrightness === 'number' && Number.isFinite(candidate.screensaverBrightness)
      ? Math.round(Math.max(0, Math.min(100, candidate.screensaverBrightness)))
      : DEFAULT_BESTPRESSO_PREFERENCES.screensaverBrightness,
    screensaverScreenOffDelaySeconds: typeof candidate.screensaverScreenOffDelaySeconds === 'number' && Number.isFinite(candidate.screensaverScreenOffDelaySeconds)
      ? Math.round(Math.max(0, Math.min(3_600, candidate.screensaverScreenOffDelaySeconds)))
      : DEFAULT_BESTPRESSO_PREFERENCES.screensaverScreenOffDelaySeconds,
    waterWarningLevelMl: Math.min(2_000, warning),
    waterCriticalLevelMl: Math.min(1_999, critical),
    chartLineWeight,
    temperatureUnit,
    clockFormat: candidate.clockFormat === '12h' || candidate.clockFormat === '24h' ? candidate.clockFormat : 'device',
    language: isLanguage(candidate.language) ? candidate.language : 'auto',
    // The morning view is the default (brief: "This is the default view").
    liveView: candidate.liveView === 'chart' ? 'chart' : 'calm',
    homeView: candidate.homeView === 'machine' ? 'machine' : 'today',
  }
}

export function readBestpressoPreferences() {
  if (typeof window === 'undefined') return DEFAULT_BESTPRESSO_PREFERENCES
  try {
    const stored = window.localStorage.getItem(BESTPRESSO_PREFERENCES_KEY)
    return normalizeBestpressoPreferences(stored ? JSON.parse(stored) : undefined)
  } catch {
    return DEFAULT_BESTPRESSO_PREFERENCES
  }
}

export function applyBestpressoPreferences(preferences = readBestpressoPreferences()) {
  setActiveLanguage(resolveLanguage(preferences.language))
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.chartLineWeight = preferences.chartLineWeight
    document.documentElement.dataset.theme = preferences.theme
    document.documentElement.dataset.animations = preferences.animationsEnabled ? 'on' : 'off'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preferences.theme === 'light' ? '#f4f5ef' : preferences.theme === 'nordic' ? '#131313' : '#171717')
  }
  return preferences
}

export function writeBestpressoPreferences(patch: Partial<BestpressoPreferences>) {
  const next = normalizeBestpressoPreferences({ ...readBestpressoPreferences(), ...patch })
  try {
    window.localStorage.setItem(BESTPRESSO_PREFERENCES_KEY, JSON.stringify(next))
  } catch {
    // The current session can still use the selection when storage is unavailable.
  }
  applyBestpressoPreferences(next)
  window.dispatchEvent(new CustomEvent(preferenceEvent, { detail: next }))
  return next
}

export function useBestpressoPreferences() {
  const [preferences, setPreferences] = useState(readBestpressoPreferences)
  useEffect(() => {
    const onPreference = (event: Event) => setPreferences((event as CustomEvent<BestpressoPreferences>).detail ?? readBestpressoPreferences())
    const onStorage = (event: StorageEvent) => {
      if (event.key === BESTPRESSO_PREFERENCES_KEY || event.key === null) setPreferences(applyBestpressoPreferences())
    }
    window.addEventListener(preferenceEvent, onPreference)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(preferenceEvent, onPreference)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return {
    preferences,
    updatePreferences: writeBestpressoPreferences,
    resetPreferences: () => writeBestpressoPreferences(DEFAULT_BESTPRESSO_PREFERENCES),
  }
}
