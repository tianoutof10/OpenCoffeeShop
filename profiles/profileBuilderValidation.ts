import type { DecaidProfile } from '../../api/decaid/types'
import { formatDecimal, plural, t } from '../../i18n/index.ts'
import { profileDraftToDecaidProfile } from './profileBuilderModel.ts'
import type { BuilderStage, ProfileDraft } from './profileBuilderModel.ts'

export type ProfileBuilderIssueSeverity = 'error' | 'warning'
export type ProfileBuilderIssuePanel = 'profile' | 'target' | 'conditions'

export interface ProfileBuilderIssue {
  id: string
  severity: ProfileBuilderIssueSeverity
  message: string
  field: string
  panel: ProfileBuilderIssuePanel
  stageId?: string
  stageIndex?: number
}

export interface ProfileBuilderValidation {
  issues: ProfileBuilderIssue[]
  errors: ProfileBuilderIssue[]
  warnings: ProfileBuilderIssue[]
  canSave: boolean
}

const MAX_STAGES = 20
const MAX_AXIS_VALUE = 15.9
const MAX_TEMPERATURE = 127.5
const MAX_STAGE_SECONDS = 127
const MAX_STAGE_VOLUME = 1023
const MAX_SOFTWARE_TARGET = 10_000

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Same rounding as the display steppers: whole numbers stay bare, everything else follows the locale decimal separator. */
const formatRangeValue = (value: number) => Number.isInteger(value) ? String(value) : formatDecimal(value, 1)

function stagePanel(field: string): ProfileBuilderIssuePanel {
  return field === 'exit' || field === 'weight' || field === 'volume' ? 'conditions' : 'target'
}

function pushRangeIssue(
  issues: ProfileBuilderIssue[],
  stage: BuilderStage,
  stageIndex: number,
  field: string,
  label: string,
  value: unknown,
  minimum: number,
  maximum: number,
  issueKey = field,
) {
  if (!finite(value)) {
    issues.push({ id: `${stage.id}-${issueKey}-number`, severity: 'error', message: t('builder.validation.mustBeNumber', { label }), field, panel: stagePanel(field), stageId: stage.id, stageIndex })
    return
  }
  if (value < minimum || value > maximum) {
    issues.push({ id: `${stage.id}-${issueKey}-range`, severity: 'error', message: t('builder.validation.mustBeBetween', { label, min: formatRangeValue(minimum), max: formatRangeValue(maximum) }), field, panel: stagePanel(field), stageId: stage.id, stageIndex })
  }
}

function expectedAxisAtStageStart(stages: BuilderStage[], stageIndex: number, axis: 'pressure' | 'flow') {
  if (stageIndex === 0) return 0
  const previous = stages[stageIndex - 1]
  if (previous.pump === axis) return previous.target
  if (previous.limiter?.type === axis && finite(previous.limiter.value) && previous.limiter.value > 0) return previous.limiter.value
  return 0
}

function axisDescription(axis: 'pressure' | 'flow', value: number) {
  return `${formatRangeValue(value)} ${axis === 'pressure' ? 'bar' : 'ml/s'}`
}

function validateSerializedProfile(profile: DecaidProfile) {
  if (typeof profile.title !== 'string' || !profile.title.trim()) return t('builder.validation.schema.noName')
  if (!Array.isArray(profile.steps) || profile.steps.length === 0) return t('builder.validation.schema.noStages')
  if (!Number.isInteger(profile.target_volume_count_start)) return t('builder.validation.schema.volumeStartNotInteger')
  if (!finite(profile.tank_temperature)) return t('builder.validation.schema.tankTemperatureInvalid')
  for (const step of profile.steps) {
    if (!step || typeof step !== 'object') return t('builder.validation.schema.invalidStage')
    if (step.pump !== 'pressure' && step.pump !== 'flow') return t('builder.validation.schema.unsupportedPump')
    if (step.transition !== 'fast' && step.transition !== 'smooth') return t('builder.validation.schema.unsupportedTransition')
    if (step.sensor !== 'coffee' && step.sensor !== 'water') return t('builder.validation.schema.unsupportedSensor')
    if (!finite(step.seconds) || !finite(step.volume) || !finite(step.temperature)) return t('builder.validation.schema.missingStageValue')
    if (step.pump === 'pressure' ? !finite(step.pressure) : !finite(step.flow)) return t('builder.validation.schema.missingAxisTarget')
    if (step.exit !== undefined && step.exit !== null && (step.exit.type !== 'pressure' && step.exit.type !== 'flow' || step.exit.condition !== 'over' && step.exit.condition !== 'under' || !finite(step.exit.value))) return t('builder.validation.schema.invalidMoveOn')
    if (step.limiter !== undefined && step.limiter !== null && (!finite(step.limiter.value) || !finite(step.limiter.range))) return t('builder.validation.schema.invalidLimiter')
  }
  try {
    const roundTrip = JSON.parse(JSON.stringify(profile)) as DecaidProfile
    if (JSON.stringify(roundTrip) !== JSON.stringify(profile)) return t('builder.validation.schema.roundTripChanged')
  } catch {
    return t('builder.validation.schema.notEncodable')
  }
  return null
}

export function validateProfileDraft(draft: ProfileDraft): ProfileBuilderValidation {
  const issues: ProfileBuilderIssue[] = []
  const addProfile = (severity: ProfileBuilderIssueSeverity, id: string, field: string, message: string) => issues.push({ id, severity, field, message, panel: 'profile' })
  const addStage = (severity: ProfileBuilderIssueSeverity, stage: BuilderStage, stageIndex: number, id: string, field: string, message: string) => issues.push({ id: `${stage.id}-${id}`, severity, field, message, panel: stagePanel(field), stageId: stage.id, stageIndex })

  if (!draft.title.trim()) addProfile('error', 'profile-title', 'title', t('builder.validation.profile.titleRequired'))
  if (!draft.stages.length) addProfile('error', 'profile-stages', 'stages', t('builder.validation.profile.stagesRequired'))
  if (draft.stages.length > MAX_STAGES) addProfile('error', 'profile-stage-count', 'stages', t('builder.validation.profile.maxStages', { max: MAX_STAGES }))
  if (!['espresso', 'calibrate', 'cleaning', 'manual', 'pourover'].includes(draft.beverageType)) addProfile('error', 'profile-beverage', 'beverageType', t('builder.validation.profile.beverageType'))
  if (!finite(draft.tankTemperature)) addProfile('error', 'profile-tank-temperature', 'tankTemperature', t('builder.validation.profile.tankTemperatureNumber'))
  if (!Number.isInteger(draft.targetVolumeCountStart)) addProfile('error', 'profile-volume-start-integer', 'targetVolumeCountStart', t('builder.validation.profile.volumeStartWhole'))
  if (finite(draft.targetWeight) && (draft.targetWeight < 0 || draft.targetWeight > MAX_SOFTWARE_TARGET)) addProfile('error', 'profile-target-weight-range', 'targetWeight', t('builder.validation.profile.targetWeightRange', { max: MAX_SOFTWARE_TARGET }))
  if (finite(draft.targetVolume) && (draft.targetVolume < 0 || draft.targetVolume > MAX_SOFTWARE_TARGET)) addProfile('error', 'profile-target-volume-range', 'targetVolume', t('builder.validation.profile.targetVolumeRange', { max: MAX_SOFTWARE_TARGET }))

  const volumeFallbackActive = finite(draft.targetVolume) && draft.targetVolume > 0
  if (volumeFallbackActive && (draft.targetVolumeCountStart < 0 || draft.targetVolumeCountStart >= draft.stages.length)) {
    addProfile('error', 'profile-volume-start-range', 'targetVolumeCountStart', t('builder.validation.profile.volumeStartRange'))
  }
  if (!(finite(draft.targetWeight) && draft.targetWeight > 0) && !volumeFallbackActive) {
    addProfile('warning', 'profile-no-final-target', 'targetWeight', t('builder.validation.profile.noFinalTarget'))
  }

  draft.stages.forEach((stage, stageIndex) => {
    if (!stage.name.trim()) addStage('warning', stage, stageIndex, 'name-empty', 'name', t('builder.validation.stage.nameEmpty'))
    if (stage.pump !== 'pressure' && stage.pump !== 'flow') addStage('error', stage, stageIndex, 'pump', 'pump', t('builder.validation.stage.pumpRequired'))
    if (stage.transition !== 'fast' && stage.transition !== 'smooth') addStage('error', stage, stageIndex, 'transition', 'transition', t('builder.validation.stage.transitionRequired'))
    if (stage.sensor !== 'coffee' && stage.sensor !== 'water') addStage('error', stage, stageIndex, 'sensor', 'sensor', t('builder.validation.stage.sensorRequired'))
    pushRangeIssue(issues, stage, stageIndex, 'target', stage.pump === 'pressure' ? t('builder.validation.label.pressureTarget') : t('builder.validation.label.flowTarget'), stage.target, 0, MAX_AXIS_VALUE)
    pushRangeIssue(issues, stage, stageIndex, 'temperature', t('common.metric.temperature'), stage.temperature, 0, MAX_TEMPERATURE)
    pushRangeIssue(issues, stage, stageIndex, 'seconds', t('builder.validation.label.maximumTime'), stage.seconds, 0, MAX_STAGE_SECONDS)
    pushRangeIssue(issues, stage, stageIndex, 'volume', t('builder.validation.label.stageVolume'), stage.volume, 0, MAX_STAGE_VOLUME)
    if (stage.weight !== undefined && stage.weight !== null) pushRangeIssue(issues, stage, stageIndex, 'weight', t('builder.stage.moveOnYieldLabel'), stage.weight, 0, MAX_SOFTWARE_TARGET)

    if (stage.exit) {
      if (stage.exit.type !== 'pressure' && stage.exit.type !== 'flow') addStage('error', stage, stageIndex, 'exit-type', 'exit', t('builder.validation.stage.exitTypeRequired'))
      if (stage.exit.condition !== 'over' && stage.exit.condition !== 'under') addStage('error', stage, stageIndex, 'exit-condition', 'exit', t('builder.validation.stage.exitConditionRequired'))
      pushRangeIssue(issues, stage, stageIndex, 'exit', t('builder.validation.label.moveOnThreshold'), stage.exit.value, 0, MAX_AXIS_VALUE)
      if (stage.limiter?.type === stage.exit.type && stage.limiter.value > 0 && stage.exit.condition === 'over' && stage.exit.value > stage.limiter.value) {
        const axisName = stage.exit.type === 'pressure' ? t('builder.axis.pressure') : t('builder.axis.flow')
        addStage('warning', stage, stageIndex, 'exit-beyond-limiter', 'exit', t('builder.validation.stage.exitBeyondLimiter', {
          axis: axisName,
          limiterValue: axisDescription(stage.exit.type, stage.limiter.value),
          exitValue: axisDescription(stage.exit.type, stage.exit.value),
          duration: plural('builder.validation.stageSeconds', stage.seconds),
        }))
      }
      const expectedAtStart = expectedAxisAtStageStart(draft.stages, stageIndex, stage.exit.type)
      if (stage.exit.condition === 'over' ? expectedAtStart >= stage.exit.value : expectedAtStart <= stage.exit.value) {
        addStage('warning', stage, stageIndex, 'exit-already-met', 'exit', t('builder.validation.stage.exitAlreadyMet', { value: axisDescription(stage.exit.type, expectedAtStart) }))
      }
    }
    if (stage.limiter) {
      const expectedLimiterType = stage.pump === 'pressure' ? 'flow' : 'pressure'
      if (stage.limiter.type !== expectedLimiterType) addStage('error', stage, stageIndex, 'limiter-type', 'limiter', stage.pump === 'pressure' ? t('builder.validation.stage.limiterMismatchPressureStage') : t('builder.validation.stage.limiterMismatchFlowStage'))
      pushRangeIssue(issues, stage, stageIndex, 'limiter', t('builder.validation.label.limiterValue'), stage.limiter.value, 0, MAX_AXIS_VALUE, 'limiter-value')
      pushRangeIssue(issues, stage, stageIndex, 'limiter', t('builder.validation.label.limiterResponseRange'), stage.limiter.range, 0, MAX_AXIS_VALUE, 'limiter-response')
    }
  })

  for (const sourceIssue of draft.importIssues ?? []) {
    issues.push({
      ...sourceIssue,
      panel: sourceIssue.stageId ? stagePanel(sourceIssue.field) : 'profile',
      stageIndex: sourceIssue.stageId ? draft.stages.findIndex((stage) => stage.id === sourceIssue.stageId) : undefined,
    })
  }

  try {
    const serialized = profileDraftToDecaidProfile(draft)
    const schemaError = validateSerializedProfile(serialized)
    if (schemaError && !issues.some((issue) => issue.severity === 'error')) addProfile('error', 'profile-round-trip', 'profile', schemaError)
  } catch {
    addProfile('error', 'profile-round-trip', 'profile', t('builder.validation.profile.conversionFailed'))
  }

  const uniqueIssues = [...new Map(issues.map((issue) => [issue.id, issue])).values()]
  const errors = uniqueIssues.filter((issue) => issue.severity === 'error')
  const warnings = uniqueIssues.filter((issue) => issue.severity === 'warning')
  return { issues: uniqueIssues, errors, warnings, canSave: errors.length === 0 }
}

export function issueSummary(validation: ProfileBuilderValidation) {
  const parts: string[] = []
  if (validation.errors.length) parts.push(plural('builder.validation.errorCount', validation.errors.length))
  if (validation.warnings.length) parts.push(plural('builder.validation.warningCount', validation.warnings.length))
  return parts.join(' · ') || t('builder.validation.readyToSave')
}
