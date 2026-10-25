import { activeLocaleTag, formatDecimal, t } from '../../i18n/index.ts'
import type { StageMoveOnReason } from './stageMoveOn.ts'
import { conditionsFromLegacy, type StageCondition } from './stageReasonData.ts'

const keys = {
  targetYield: 'brew.stage.reason.targetYieldReached', targetVolume: 'brew.stage.reason.targetVolumeReached',
  manualStop: 'brew.stage.reason.manualStop', manualAdvance: 'brew.stage.reason.manualAdvance',
  machineError: 'brew.stage.reason.machineError', connectionLost: 'brew.stage.reason.connectionLost',
  unknown: 'brew.stage.reason.unknown', timeLimit: 'brew.stage.reason.timeLimitReached',
  stageYield: 'brew.stage.reason.stageYieldReached', stageVolume: 'brew.stage.reason.stageVolumeReached',
} as const
const compactKeys = {
  targetYield: 'brew.stage.condition.targetYield', targetVolume: 'brew.stage.condition.targetVolume',
  timeLimit: 'brew.stage.condition.timeLimit', stageYield: 'brew.stage.condition.stageYield', stageVolume: 'brew.stage.condition.stageVolume',
} as const
const isReached = (condition: StageCondition) => condition.code === 'sensor' || condition.code in compactKeys

const conditionText = (condition: StageCondition, compact = false): string => {
  if (condition.code === 'legacy') return condition.text
  if (condition.code === 'sensor') return t(compact ? 'brew.stage.condition.sensor' : 'brew.stage.reason.sensorExitReached', {
    type: t(condition.sensor === 'pressure' ? 'brew.metric.pressure' : 'common.metric.flow'),
    symbol: condition.comparison === 'over' ? '>' : '<',
    value: formatDecimal(condition.threshold, String(condition.threshold).split('.')[1]?.length ?? 0),
    unit: condition.sensor === 'pressure' ? 'bar' : 'ml/s',
  })
  if (compact && condition.code in compactKeys) return t(compactKeys[condition.code as keyof typeof compactKeys])
  return t(keys[condition.code])
}

export interface StageReasonPart { type: 'reason' | 'separator'; text: string }
/** Whole phrase templates own word order. No translated suffix stripping or English matching. */
export function stageReasonParts(reason?: string | StageMoveOnReason): StageReasonPart[] {
  const conditions = typeof reason === 'object' && reason.conditions?.length ? reason.conditions
    : conditionsFromLegacy(typeof reason === 'string' ? reason : reason?.label)
  if (conditions.length === 1) return [{ type: 'reason', text: conditionText(conditions[0]) }]
  const sharedReached = conditions.every(isReached)
  const texts = conditions.map(condition => conditionText(condition, sharedReached))
  let parts: StageReasonPart[]
  try {
    parts = new Intl.ListFormat(activeLocaleTag(), { style: 'long', type: 'disjunction' }).formatToParts(texts)
      .map(part => ({ type: part.type === 'element' ? 'reason' : 'separator', text: part.value }))
  } catch {
    parts = texts.flatMap((text, i): StageReasonPart[] => [...(i ? [{ type: 'separator' as const, text: ' ' + t('brew.liveStages.reasonSeparator') + ' ' }] : []), { type: 'reason', text }])
  }
  if (!sharedReached) return parts
  // The unique insertion marker allows the translated verb before OR after the complete list.
  const marker = '\uFFFC'
  const [before, after] = t('brew.stage.reason.alternativesReached', { conditions: marker }).split(marker)
  if (before) parts[0] = { ...parts[0], text: before + parts[0].text }
  if (after) parts[parts.length - 1] = { ...parts.at(-1)!, text: parts.at(-1)!.text + after }
  return parts
}

/** Compatibility helper for review fixtures/tests; UI uses parts to retain localized separators. */
export const stageReasonLabels = (reason?: string | StageMoveOnReason) => stageReasonParts(reason).filter(part => part.type === 'reason').map(part => part.text)
