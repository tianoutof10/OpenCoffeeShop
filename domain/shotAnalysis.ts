import type { LiveShotPoint } from './brewing.ts'

/**
 * Puck-resistance analysis for one recorded espresso extraction.
 *
 * Display-only and deterministic. Every finding carries the sample evidence it
 * was derived from. Resistance follows Decent's published convention,
 * R = pressure / flow² (bar per (ml/s)²). See docs/shot-analysis-and-dial-in.md.
 */

export const ANALYSIS_THRESHOLDS = {
  /** Below this flow the pump is filling, blooming or paused: resistance is undefined. */
  minFlowMlPerSecond: 0.5,
  minPressureBar: 1,
  /** First pressure at which the puck counts as pressurised (headspace full). */
  pressurisedBar: 2,
  /** Ignore this long after pressurisation while the bed settles. */
  settleMs: 1_000,
  smoothingHalfWindowMs: 600,
  /** Reference window before each sample: [t - referenceFromMs, t - referenceToMs]. */
  referenceFromMs: 1_500,
  referenceToMs: 500,
  suddenDropFraction: 0.35,
  /** The following sample must still be this far below the reference (fraction of suddenDropFraction). */
  confirmationShare: 0.7,
  confirmationWithinMs: 1_500,
  stageTransitionGuardMs: 1_000,
  commandedChangeFraction: 0.15,
  mergeWithinMs: 2_000,
  tailIgnoreMs: 2_000,
  strongDropFraction: 0.5,
  chokedPressureBar: 7,
  chokedFlowMlPerSecond: 0.7,
  chokedWeightFlowGramsPerSecond: 0.6,
  chokedMinimumMs: 5_000,
  firstDropsGrams: 1,
  steadinessMinimumMs: 6_000,
  steadinessMinimumSamples: 5,
  /** Peak and breakdown are measured from the main extraction: pressure ≥ max(minBar, share × shot peak). */
  mainExtractionShare: 0.6,
  mainExtractionMinBar: 4,
  steadyRSquared: 0.8,
  unevenRSquared: 0.5,
} as const

export type ShotFinding =
  | {
    kind: 'suddenResistanceDrop'
    atMs: number
    /** Fraction by which smoothed resistance fell versus the preceding reference window (0–1). */
    dropFraction: number
    fromResistance: number
    toResistance: number
    pressure?: number
    flow?: number
    severity: 'moderate' | 'strong'
    /** Early = in the first third of the pressurised extraction. */
    phase: 'early' | 'late'
  }
  | {
    kind: 'chokedFlow'
    atMs: number
    durationMs: number
    meanPressure: number
    meanFlow: number
  }

export interface ResistanceSample { elapsedMs: number; resistance: number; smoothed: number }

export interface ShotAnalysis {
  /** False when there was not enough pressurised flow to say anything. */
  analysable: boolean
  findings: ShotFinding[]
  firstDropsMs?: number
  pressurisedAtMs?: number
  /** Start of the main extraction (after fill/infusion), where peak and breakdown are measured. */
  mainExtractionAtMs?: number
  peakResistance?: number
  peakResistanceAtMs?: number
  finalResistance?: number
  /** 1 - final / peak: how much the puck's resistance fell after its peak. */
  resistanceDecline?: number
  breakdown?: 'steady' | 'uneven' | 'mixed'
  resistance: ResistanceSample[]
}

type Thresholds = { -readonly [Key in keyof typeof ANALYSIS_THRESHOLDS]: number }

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const median = (values: number[]) => {
  if (!values.length) return undefined
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** First index whose elapsedMs is ≥ target (samples are time-ordered). Keeps live analysis O(n log n). */
function lowerBound(samples: Array<{ elapsedMs: number }>, target: number) {
  let low = 0, high = samples.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (samples[middle].elapsedMs < target) low = middle + 1
    else high = middle
  }
  return low
}

function between<T extends { elapsedMs: number }>(samples: T[], fromMs: number, toMs: number) {
  return samples.slice(lowerBound(samples, fromMs), lowerBound(samples, toMs + 0.0001))
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)

export function puckResistance(point: Pick<LiveShotPoint, 'pressure' | 'flow'>, thresholds: Pick<Thresholds, 'minFlowMlPerSecond' | 'minPressureBar'> = ANALYSIS_THRESHOLDS) {
  if (!finite(point.pressure) || !finite(point.flow)) return undefined
  if (point.flow < thresholds.minFlowMlPerSecond || point.pressure < thresholds.minPressureBar) return undefined
  return point.pressure / (point.flow * point.flow)
}

function linearFitRSquared(samples: Array<{ x: number; y: number }>) {
  const meanX = mean(samples.map(sample => sample.x))
  const meanY = mean(samples.map(sample => sample.y))
  let covariance = 0, varianceX = 0, varianceY = 0
  for (const { x, y } of samples) {
    covariance += (x - meanX) * (y - meanY)
    varianceX += (x - meanX) ** 2
    varianceY += (y - meanY) ** 2
  }
  if (varianceX === 0 || varianceY === 0) return 1
  return covariance ** 2 / (varianceX * varianceY)
}

const relativeChange = (from: number | undefined, to: number | undefined) => {
  if (!finite(from) || !finite(to)) return 0
  const base = Math.max(Math.abs(from), 0.1)
  return Math.abs(to - from) / base
}

export function analyseShot(points: LiveShotPoint[], overrides: Partial<Thresholds> = {}): ShotAnalysis {
  const limits: Thresholds = { ...ANALYSIS_THRESHOLDS, ...overrides }
  const ordered = points.filter(point => finite(point.elapsedMs)).sort((left, right) => left.elapsedMs - right.elapsedMs)
  const firstDropsMs = ordered.find(point => finite(point.weight) && point.weight >= limits.firstDropsGrams)?.elapsedMs
  const pressurisedAtMs = ordered.find(point => finite(point.pressure) && point.pressure >= limits.pressurisedBar)?.elapsedMs
  const empty: ShotAnalysis = { analysable: false, findings: [], firstDropsMs, pressurisedAtMs, resistance: [] }
  if (pressurisedAtMs === undefined) return empty

  const raw = ordered.flatMap(point => {
    if (point.elapsedMs < pressurisedAtMs + limits.settleMs) return []
    const resistance = puckResistance(point, limits)
    return resistance === undefined ? [] : [{ point, elapsedMs: point.elapsedMs, resistance }]
  })
  if (raw.length < 3) return empty

  const resistance: ResistanceSample[] = raw.map(sample => ({
    elapsedMs: sample.elapsedMs,
    resistance: sample.resistance,
    smoothed: median(between(raw, sample.elapsedMs - limits.smoothingHalfWindowMs, sample.elapsedMs + limits.smoothingHalfWindowMs).map(other => other.resistance))!,
  }))

  const extractionEndMs = ordered.at(-1)!.elapsedMs
  const pressurisedDurationMs = Math.max(1, extractionEndMs - pressurisedAtMs)
  const stageChanges = ordered.flatMap((point, index) => index > 0 && point.stageIndex !== ordered[index - 1].stageIndex ? [point.elapsedMs] : [])
  const nearStageChange = (fromMs: number, toMs: number) => stageChanges.some(change => change >= fromMs - limits.stageTransitionGuardMs && change <= toMs + limits.stageTransitionGuardMs)
  const pointsBetween = (fromMs: number, toMs: number) => between(ordered, fromMs, toMs)
  const commandedChange = (fromMs: number, toMs: number) => {
    const window = pointsBetween(fromMs, toMs)
    if (window.length < 2) return false
    const first = window[0], last = window.at(-1)!
    return relativeChange(first.targetPressure, last.targetPressure) > limits.commandedChangeFraction
      || relativeChange(first.targetFlow, last.targetFlow) > limits.commandedChangeFraction
  }

  const referenceFor = (sampleMs: number) => median(between(resistance, sampleMs - limits.referenceFromMs, sampleMs - limits.referenceToMs).map(other => other.smoothed))

  const drops: Extract<ShotFinding, { kind: 'suddenResistanceDrop' }>[] = []
  resistance.forEach((sample, index) => {
    if (sample.elapsedMs > extractionEndMs - limits.tailIgnoreMs) return
    const reference = referenceFor(sample.elapsedMs)
    if (reference === undefined || reference <= 0) return
    const dropFraction = 1 - sample.smoothed / reference
    if (dropFraction < limits.suddenDropFraction) return
    const next = resistance[index + 1]
    if (!next || next.elapsedMs - sample.elapsedMs > limits.confirmationWithinMs) return
    if (1 - next.smoothed / reference < limits.suddenDropFraction * limits.confirmationShare) return
    const windowStart = sample.elapsedMs - limits.referenceFromMs
    if (nearStageChange(windowStart, sample.elapsedMs)) return
    if (commandedChange(windowStart, sample.elapsedMs)) return
    const source = raw[index].point
    const finding = {
      kind: 'suddenResistanceDrop' as const,
      atMs: sample.elapsedMs,
      dropFraction,
      fromResistance: reference,
      toResistance: sample.smoothed,
      pressure: source.pressure,
      flow: source.flow,
      severity: dropFraction >= limits.strongDropFraction ? 'strong' as const : 'moderate' as const,
      phase: sample.elapsedMs - pressurisedAtMs <= pressurisedDurationMs / 3 ? 'early' as const : 'late' as const,
    }
    const previous = drops.at(-1)
    if (previous && sample.elapsedMs - previous.atMs <= limits.mergeWithinMs) {
      if (finding.dropFraction > previous.dropFraction) drops[drops.length - 1] = { ...finding, atMs: previous.atMs, phase: previous.phase }
      return
    }
    drops.push(finding)
  })

  const choked: Extract<ShotFinding, { kind: 'chokedFlow' }>[] = []
  let run: LiveShotPoint[] = []
  const closeRun = () => {
    if (run.length >= 2) {
      const durationMs = run.at(-1)!.elapsedMs - run[0].elapsedMs
      if (durationMs >= limits.chokedMinimumMs) choked.push({
        kind: 'chokedFlow', atMs: run[0].elapsedMs, durationMs,
        meanPressure: mean(run.map(point => point.pressure!)), meanFlow: mean(run.map(point => point.flow!)),
      })
    }
    run = []
  }
  for (const point of ordered) {
    if (point.elapsedMs < pressurisedAtMs + limits.settleMs) continue
    const stalled = finite(point.pressure) && finite(point.flow)
      && point.pressure >= limits.chokedPressureBar && point.flow <= limits.chokedFlowMlPerSecond
      && (!finite(point.weightFlow) || point.weightFlow <= limits.chokedWeightFlowGramsPerSecond)
    if (stalled) run.push(point)
    else closeRun()
  }
  closeRun()

  // Low-pressure infusion steps (e.g. 3 bar at 0.8 ml/s) give high resistance readings that are not
  // extraction; measuring shape from there misreads a clean shot as uneven (found on a real LRv3 shot).
  const shotPeakPressure = Math.max(...ordered.map(point => finite(point.pressure) ? point.pressure : 0))
  const mainThreshold = Math.max(limits.mainExtractionMinBar, shotPeakPressure * limits.mainExtractionShare)
  const mainExtractionAtMs = shotPeakPressure >= limits.mainExtractionMinBar ? ordered.find(point => finite(point.pressure) && point.pressure >= mainThreshold)?.elapsedMs : undefined
  const mainSamples = mainExtractionAtMs === undefined ? resistance : resistance.filter(sample => sample.elapsedMs >= mainExtractionAtMs)
  const shapeSamples = mainSamples.length >= 3 ? mainSamples : resistance
  const peak = shapeSamples.reduce((best, sample) => sample.smoothed > best.smoothed ? sample : best, shapeSamples[0])
  const tailStart = resistance.at(-1)!.elapsedMs - Math.max(2_000, (resistance.at(-1)!.elapsedMs - peak.elapsedMs) * 0.2)
  const finalResistance = median(shapeSamples.filter(sample => sample.elapsedMs >= tailStart).map(sample => sample.smoothed))
  const afterPeak = shapeSamples.filter(sample => sample.elapsedMs >= peak.elapsedMs)
  let breakdown: ShotAnalysis['breakdown']
  if (afterPeak.length >= limits.steadinessMinimumSamples && afterPeak.at(-1)!.elapsedMs - peak.elapsedMs >= limits.steadinessMinimumMs) {
    const rSquared = linearFitRSquared(afterPeak.map(sample => ({ x: sample.elapsedMs, y: sample.smoothed })))
    breakdown = rSquared >= limits.steadyRSquared ? 'steady' : rSquared < limits.unevenRSquared ? 'uneven' : 'mixed'
    // An abrupt fall after the peak is, by definition, not a steady breakdown.
    if (drops.some(drop => drop.atMs >= peak.elapsedMs)) breakdown = 'uneven'
  }

  return {
    analysable: true,
    findings: [...choked, ...drops].sort((left, right) => left.atMs - right.atMs),
    firstDropsMs,
    pressurisedAtMs,
    ...(mainExtractionAtMs !== undefined ? { mainExtractionAtMs } : {}),
    peakResistance: peak.smoothed,
    peakResistanceAtMs: peak.elapsedMs,
    finalResistance,
    resistanceDecline: finalResistance === undefined || peak.smoothed <= 0 ? undefined : Math.max(0, 1 - finalResistance / peak.smoothed),
    breakdown,
    resistance,
  }
}

export const hasFinding = (analysis: Pick<ShotAnalysis, 'findings'>, kind: ShotFinding['kind']) => analysis.findings.some(finding => finding.kind === kind)
