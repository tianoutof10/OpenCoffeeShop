import type { DecaidProfileStep } from '../../api/decaid/types.ts'
import type { LiveShotPoint, PreviousShot } from '../../domain/brewing.ts'
import { conditionsFromLegacy, legacyConditionLabel, type StageCondition } from './stageReasonData.ts'

export const STAGE_REASON_VERSION = 3
export interface StageAdvanceEvidence {
  frame: number
  timestamp: number
  reason: 'manual' | 'weight'
}
export interface StageMoveOnReason {
  conditions?: StageCondition[]
  label: string
  source: 'recorded' | 'telemetry' | 'unknown'
  kind: 'advance' | 'stop'
}
export interface StageReasonAnalysis {
  version: number
  reasons: Record<string, StageMoveOnReason>
}
export const stageReasonKey = (point: LiveShotPoint) => `${point.stageIndex ?? point.stageName ?? 'Extraction'}:${point.elapsedMs}`
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const positive = (n: unknown): n is number => finite(n) && n > 0
const numeric = (n: unknown): number | undefined => {
  const value = typeof n === 'string' && n.trim() ? Number(n) : n
  return finite(value) ? value : undefined
}
const firmwareSeconds = (seconds: number) => seconds >= 12.75 ? Math.min(127, Math.round(seconds)) : Math.round(seconds * 10) / 10
const closeSamples = (a: LiveShotPoint, b: LiveShotPoint) => b.elapsedMs > a.elapsedMs && b.elapsedMs - a.elapsedMs <= 1500

function sensorExitReached(group: LiveShotPoint[], next: LiveShotPoint | undefined, type: 'pressure' | 'flow', condition: string, value: number) {
  const last = group.at(-1)!, before = group.at(-2)
  // Machine family is not present in every historical record. Retain the raw
  // target and both transport encodings as plausible (not recorded) thresholds.
  const thresholds = [value, Math.round(value * 16) / 16, Math.round(value * 10) / 10].filter(v => v > 0)
  const reached = (reading: number, threshold: number) => condition === 'over' ? reading >= threshold : reading <= threshold
  return thresholds.some(threshold => {
    const reading = last[type]
    if (!finite(reading)) return false
    if (reached(reading, threshold)) return true
    // Allow a crossing carried by the first new-frame sample only when the old
    // stage was already near and moving toward that threshold. Do not infer
    // from an arbitrary new-stage target jump or later new-stage samples.
    const prior = before?.[type], following = next?.[type]
    if (!before || !next || !closeSamples(before, last) || !closeSamples(last, next)
      || !finite(prior) || !finite(following) || !reached(following, threshold)) return false
    const direction = condition === 'over' ? 1 : -1
    const trend = (reading - prior) * direction
    const projectedChange = trend * (next.elapsedMs - last.elapsedMs) / (last.elapsedMs - before.elapsedMs)
    const distance = Math.abs(threshold - reading)
    return trend > 0 && distance <= Math.min(0.5, Math.max(0.1, projectedChange + 1 / 16))
  })
}
const stopConditions: Record<string, StageCondition> = {
  targetWeight: { code: 'targetYield' }, targetVolume: { code: 'targetVolume' },
  apiStop: { code: 'manualStop' }, appStop: { code: 'manualStop' },
  error: { code: 'machineError' }, disconnected: { code: 'connectionLost' },
}

/** Analyse observed boundaries, never fabricate unobserved stages.
 * Boundary-window candidates are inferences, not firmware-reported causes.
 * Firmware limiters are intentionally NOT exits. */
export function analyseStageMoveOn(points: LiveShotPoint[], steps: DecaidProfileStep[] = [], options: {
  active?: boolean; evidence?: StageAdvanceEvidence[]; telemetryStartedAt?: number; stopReason?: string
} = {}): StageReasonAnalysis {
  const groups: LiveShotPoint[][] = []
  for (const point of points) {
    if (!finite(point.elapsedMs)) continue
    const group = groups.at(-1)
    const previous = group?.at(-1)
    if (!previous || previous.stageIndex !== point.stageIndex || (point.stageIndex === undefined && previous.stageName !== point.stageName)) groups.push([point])
    else group!.push(point)
  }
  const reasons: StageReasonAnalysis['reasons'] = {}
  groups.forEach((group, index) => {
    const first = group[0], last = group.at(-1)!, next = groups[index + 1]?.[0]
    if (!next && options.active) return
    const kind = next ? 'advance' : 'stop'
    const put = (conditions: StageCondition[], source: StageMoveOnReason['source']) => {
      if (!conditions.length) conditions = [{ code: 'unknown' }]
      reasons[stageReasonKey(first)] = { conditions, label: conditions.map(legacyConditionLabel).join(' or '), source, kind }
    }
    if (!next) {
      const condition = options.stopReason && stopConditions[options.stopReason]
      if (condition) { put([condition], 'recorded'); return }
      // Only the last configured stage can naturally finish the profile. Never
      // reinterpret an early interruption or an unfamiliar explicit stop code.
      if (first.stageIndex !== steps.length - 1 || (options.stopReason && options.stopReason !== 'machineEnded')) {
        put([{ code: 'unknown' }], 'unknown'); return
      }
    }
    // An issued request only explains an observed, adjacent advance of its own
    // frame within two seconds. Replays, late requests and jumps aren't proof.
    const boundary = next && finite(options.telemetryStartedAt) ? options.telemetryStartedAt + next.elapsedMs : undefined
    const explicit = boundary === undefined || first.stageIndex === undefined || next?.stageIndex !== first.stageIndex + 1 ? []
      : (options.evidence ?? []).filter(e => e.frame === first.stageIndex && finite(e.timestamp)
        && e.timestamp >= options.telemetryStartedAt! + first.elapsedMs
        && e.timestamp <= boundary && boundary - e.timestamp <= 2000)
    if (explicit.length) {
      const codes = [...new Set(explicit.map(e => e.reason === 'manual' ? 'manualAdvance' as const : 'stageYield' as const))]
      put(codes.map(code => ({ code })), 'recorded')
      return
    }
    const step = first.stageIndex === undefined ? undefined : steps[first.stageIndex]
    const boundaryCovered = !next || closeSamples(last, next)
    const forward = !next || (next.stageIndex !== undefined && next.stageIndex > first.stageIndex!)
    if (!step || !boundaryCovered || !forward) { put([{ code: 'unknown' }], 'unknown'); return }
    const adjacent = next?.stageIndex === first.stageIndex! + 1
    const contiguous = group.every((p, i) => i === 0 || closeSamples(group[i - 1], p))
    const candidates: StageCondition[] = []
    const previous = groups[index - 1]?.at(-1)
    const knownStart = index > 0 ? previous?.stageIndex === first.stageIndex! - 1 && closeSamples(previous, first)
      : first.stageIndex === 0 && first.elapsedMs === 0
    // Boundary timing is an interval, not the timestamp of the first new sample.
    const minimumTime = last.elapsedMs - first.elapsedMs
    const recent = group.at(-2)
    const sampleInterval = recent && closeSamples(recent, last) ? Math.min(500, last.elapsedMs - recent.elapsedMs) : 0
    // For a terminal frame or a jump, do not attribute the entire gap to this
    // stage: use at most one recent sampling interval at its end.
    const endUpper = adjacent ? next!.elapsedMs : last.elapsedMs + sampleInterval
    const maximumTime = endUpper - (knownStart ? previous?.elapsedMs ?? first.elapsedMs : first.elapsedMs)
    const seconds = numeric(step.seconds)
    if (knownStart && positive(seconds) && [seconds, firmwareSeconds(seconds)].some(value => value * 1000 >= minimumTime - 100 && value * 1000 <= maximumTime + 100)) candidates.push({ code: 'timeLimit' })
    const exit = step.exit
    const exitValue = numeric(exit?.value)
    if (exit && positive(exitValue) && (exit.type === 'pressure' || exit.type === 'flow') && (exit.condition === 'over' || exit.condition === 'under')) {
      if (sensorExitReached(group, adjacent ? next : undefined, exit.type, exit.condition, exitValue)) {
        // Show the saved recipe threshold, not the sampled reading or a possible
        // firmware-rounded value. Symbols match the profile's over/under choice.
        candidates.push({ code: 'sensor', sensor: exit.type, comparison: exit.condition, threshold: exitValue })
      }
    }
    // Historical projected-weight decisions aren't recoverable. Actual weight
    // crossing is only an inferred candidate, never an explicit override.
    const weight = numeric(step.weight), stageVolume = numeric(step.volume)
    if (positive(weight) && finite(last.weight) && last.weight >= weight) candidates.push({ code: 'stageYield' })
    if (knownStart && contiguous && positive(stageVolume) && group.length > 1 && group.every(p => finite(p.flow))) {
      let volume = 0
      for (let i = 1; i < group.length; i++) volume += Math.max(0, (group[i - 1].flow! + group[i].flow!) / 2) * (group[i].elapsedMs - group[i - 1].elapsedMs) / 1000
      const uncertainty = Math.max(0, first.flow!, last.flow!) * ((first.elapsedMs - (previous?.elapsedMs ?? first.elapsedMs)) + endUpper - last.elapsedMs) / 1000
      if ([stageVolume, Math.floor(stageVolume)].some(v => v > 0 && v >= volume && v <= volume + uncertainty)) candidates.push({ code: 'stageVolume' })
    }
    put(candidates, candidates.length ? 'telemetry' : 'unknown')
  })
  return { version: STAGE_REASON_VERSION, reasons }
}

export function reconcileStageReasons(detail: PreviousShot, signature?: string): PreviousShot {
  if (detail.stageReasons?.version === STAGE_REASON_VERSION || !detail.points?.length) {
    const analysis = detail.stageReasons
    if (!analysis || Object.values(analysis.reasons).every(reason => reason.conditions)) return detail
    // No re-inference: preserve the old decision, source, boundaries and text.
    return { ...detail, stageReasons: { ...analysis, reasons: Object.fromEntries(Object.entries(analysis.reasons).map(([key, reason]) => [key, reason.conditions ? reason : { ...reason, conditions: conditionsFromLegacy(reason.label) }])) } }
  }
  // Old cached details didn't retain the recipe, but their revision signature
  // contains the shot-time workflow. Never substitute today's selected recipe.
  let saved: { workflow?: { profile?: { steps?: DecaidProfileStep[] } }; stopReason?: string } = {}
  try { saved = signature ? JSON.parse(signature) : {} } catch { /* legacy cache */ }
  const profileSteps = detail.profileSteps ?? saved?.workflow?.profile?.steps
  const stopReason = detail.stopReason ?? saved?.stopReason
  return { ...detail, profileSteps, stopReason, stageReasons: analyseStageMoveOn(detail.points, profileSteps, {
    evidence: detail.stageEvidence, telemetryStartedAt: detail.telemetryStartedAt, stopReason,
  }) }
}
