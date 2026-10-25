import type { DecaidProfile, DecaidProfileRecord, DecaidProfileStep } from '../../api/decaid/types'
import { t } from '../../i18n/index.ts'

type CanonicalStep = {
  name: string
  pump: 'pressure' | 'flow'
  transition: 'fast' | 'smooth'
  exit: { type: 'pressure' | 'flow'; condition: 'over' | 'under'; value: number } | null
  volume: number
  seconds: number
  weight: number | null
  temperature: number
  sensor: 'coffee' | 'water'
  pressure?: number
  flow?: number
  limiter: { value: number; range: number } | null
}

export type CanonicalProfile = {
  version: string | null
  title: string
  notes: string
  author: string
  beverage_type: 'espresso' | 'calibrate' | 'cleaning' | 'manual' | 'pourover'
  steps: CanonicalStep[]
  target_volume: number | null
  target_weight: number | null
  target_volume_count_start: number
  tank_temperature: number
}

export class ProfileSaveVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileSaveVerificationError'
  }
}

const optionalNumber = (value: unknown) => value === null || value === undefined ? null : Number(value)

function canonicalStep(step: DecaidProfileStep): CanonicalStep {
  const pump = step.pump === 'pressure' ? 'pressure' : 'flow'
  return {
    name: String(step.name ?? ''),
    pump,
    transition: step.transition === 'smooth' ? 'smooth' : 'fast',
    exit: step.exit
      ? {
          type: step.exit.type === 'flow' ? 'flow' : 'pressure',
          condition: step.exit.condition === 'under' ? 'under' : 'over',
          value: Number(step.exit.value),
        }
      : null,
    volume: Number(step.volume),
    seconds: Number(step.seconds),
    weight: optionalNumber(step.weight),
    temperature: Number(step.temperature),
    sensor: step.sensor === 'water' ? 'water' : 'coffee',
    ...(pump === 'pressure' ? { pressure: Number(step.pressure) } : { flow: Number(step.flow) }),
    limiter: step.limiter
      ? { value: Number(step.limiter.value), range: Number(step.limiter.range) }
      : null,
  }
}

export function canonicalProfileForVerification(profile: DecaidProfile): CanonicalProfile {
  const beverageType = profile.beverage_type
  return {
    version: profile.version === null || profile.version === undefined ? null : String(profile.version),
    title: String(profile.title ?? ''),
    notes: String(profile.notes ?? ''),
    author: String(profile.author ?? ''),
    beverage_type: beverageType === 'calibrate' || beverageType === 'cleaning' || beverageType === 'manual' || beverageType === 'pourover'
      ? beverageType
      : 'espresso',
    steps: (profile.steps ?? []).map(canonicalStep),
    target_volume: optionalNumber(profile.target_volume),
    target_weight: optionalNumber(profile.target_weight),
    target_volume_count_start: Number(profile.target_volume_count_start),
    tank_temperature: Number(profile.tank_temperature),
  }
}

function normalizedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalizedJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${normalizedJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function assertVerifiedProfileRecord(
  expectedProfile: DecaidProfile,
  expectedMetadata: Record<string, unknown> | null | undefined,
  expectedParentId: string | null,
  record: DecaidProfileRecord,
) {
  if (!record.id) throw new ProfileSaveVerificationError(t('library.verification.missingId'))
  if (record.visibility !== 'visible') throw new ProfileSaveVerificationError(t('library.verification.notVisible'))
  if (!record.profile) throw new ProfileSaveVerificationError(t('library.verification.missingExecutionData'))
  if (normalizedJson(canonicalProfileForVerification(record.profile)) !== normalizedJson(canonicalProfileForVerification(expectedProfile))) {
    throw new ProfileSaveVerificationError(t('library.verification.executionDataChanged'))
  }
  if (normalizedJson(record.metadata ?? null) !== normalizedJson(expectedMetadata ?? null)) {
    throw new ProfileSaveVerificationError(t('library.verification.metadataChanged'))
  }
  if ((record.parentId ?? null) !== expectedParentId) {
    throw new ProfileSaveVerificationError(t('library.verification.unexpectedLineage'))
  }
}

export function assertMatchingProfileReadback(saved: DecaidProfileRecord, readback: DecaidProfileRecord) {
  if (!saved.id || saved.id !== readback.id) {
    throw new ProfileSaveVerificationError(t('library.verification.readbackMismatch'))
  }
}
