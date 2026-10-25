import { t } from '../i18n/index.ts'
import type { EditableMachineSetting, EditableProfileSetting } from './brewing'

export type BuilderValueAdjustmentKey =
  | 'builderPressure'
  | 'builderFlow'
  | 'builderTemperature'
  | 'builderDuration'
  | 'builderVolume'
  | 'builderYield'

export type BuiltInValueAdjustmentKey = EditableMachineSetting | EditableProfileSetting | BuilderValueAdjustmentKey
export type SettingsValueAdjustmentKey = `settings:${string}`
export type ValueAdjustmentKey = BuiltInValueAdjustmentKey | SettingsValueAdjustmentKey
export type ValueAdjustmentMode = 'integer' | 'decimal'

export interface FixedValueSuggestion {
  label: string
  detail: string
  value: number
}

export interface ValueAdjustmentDefinition {
  title: string
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  defaultValue?: number
  suggestions: readonly number[]
}

export const MAX_VALUE_SUGGESTIONS = 8

export const VALUE_ADJUSTMENTS = {
  hotWaterVolume: {
    get title() { return t('shell.adjust.hotWaterVolume.title') },
    min: 0,
    max: 250,
    step: 1,
    mode: 'integer',
    suggestions: [],
  },
  hotWaterTemperature: {
    get title() { return t('shell.adjust.hotWaterTemperature.title') },
    min: 35,
    max: 95,
    step: 1,
    mode: 'integer',
    suggestions: [],
  },
  steamTemperature: {
    get title() { return t('shell.adjust.steamTemperature.title') },
    min: 135,
    max: 170,
    step: 1,
    mode: 'integer',
    suggestions: [150, 155, 160, 165, 170],
  },
  hotWaterDuration: {
    get title() { return t('shell.adjust.hotWaterDuration.title') },
    min: 5,
    max: 120,
    step: 5,
    mode: 'integer',
    suggestions: [],
  },
  steamDuration: {
    get title() { return t('shell.adjust.steamDuration.title') },
    min: 0,
    max: 120,
    step: 1,
    mode: 'integer',
    suggestions: [],
  },
  steamFlow: {
    get title() { return t('shell.adjust.steamFlow.title') },
    min: 0.4,
    max: 2.5,
    step: 0.1,
    mode: 'decimal',
    suggestions: [0.6, 0.8, 1, 1.2, 1.4],
  },
  temperature: {
    get title() { return t('shell.adjust.temperature.title') },
    min: 80,
    max: 100,
    step: 1,
    mode: 'integer',
    suggestions: [86, 88, 90, 92, 94, 96, 98],
  },
  grindSetting: {
    get title() { return t('shell.adjust.grindSetting.title') },
    min: 0,
    max: 2500,
    step: 0.1,
    mode: 'decimal',
    defaultValue: 20,
    suggestions: [],
  },
  dose: {
    get title() { return t('shell.adjust.dose.title') },
    min: 0,
    max: 30,
    step: 0.1,
    mode: 'decimal',
    defaultValue: 18,
    suggestions: [7, 16, 18, 20, 22, 24],
  },
  targetYield: {
    get title() { return t('shell.adjust.targetYield.title') },
    min: 0,
    max: 1000,
    step: 0.1,
    mode: 'decimal',
    defaultValue: 36,
    suggestions: [14, 18, 20, 36, 40, 44, 48, 50],
  },
  builderPressure: {
    get title() { return t('shell.adjust.builderPressure.title') },
    min: 0,
    max: 15.9,
    step: 0.1,
    mode: 'decimal',
    suggestions: [2, 4, 6, 8, 9, 10, 12],
  },
  builderFlow: {
    get title() { return t('shell.adjust.builderFlow.title') },
    min: 0,
    max: 15.9,
    step: 0.1,
    mode: 'decimal',
    suggestions: [1, 2, 3, 4, 6, 8],
  },
  builderTemperature: {
    get title() { return t('shell.adjust.builderTemperature.title') },
    min: 0,
    max: 127.5,
    step: 0.5,
    mode: 'decimal',
    suggestions: [80, 85, 90, 93, 95, 100],
  },
  builderDuration: {
    get title() { return t('shell.adjust.builderDuration.title') },
    min: 0,
    max: 127,
    step: 1,
    mode: 'integer',
    suggestions: [5, 10, 15, 20, 30, 40, 60],
  },
  builderVolume: {
    get title() { return t('shell.adjust.builderVolume.title') },
    min: 0,
    max: 1023,
    step: 1,
    mode: 'integer',
    suggestions: [10, 20, 30, 40, 60, 100],
  },
  builderYield: {
    get title() { return t('shell.adjust.builderYield.title') },
    min: 0,
    max: 1000,
    step: 0.1,
    mode: 'decimal',
    suggestions: [10, 20, 30, 36, 40, 50],
  },
} as const satisfies Record<BuiltInValueAdjustmentKey, ValueAdjustmentDefinition>
