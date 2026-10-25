import type { LiveShotPoint } from './brewing.ts'
import { hasFinding, type ShotAnalysis } from './shotAnalysis.ts'

/**
 * How quickly the cup filled, from first drops to the end of the shot.
 *
 * This is what decides between "grind" and "ratio" when a shot tastes sour or
 * bitter: a sour shot that ran fast wants a finer grind; a sour shot that ran at
 * a normal pace wants more water through the puck. Weight flow is used instead
 * of shot time so long pre-infusions and blooms don't read as "slow".
 */
export type ShotPace = 'fast' | 'normal' | 'slow'

export const PACE_THRESHOLDS = {
  /** Mean cup weight gain at or above this (g/s) after first drops is a fast shot. */
  fastGramsPerSecond: 2.4,
  /** At or below this (g/s) is a slow shot. */
  slowGramsPerSecond: 1.0,
  minimumContactMs: 5_000,
  minimumYieldGrams: 8,
} as const

export interface PaceReading {
  pace: ShotPace
  gramsPerSecond: number
  contactMs: number
  /** Present when the pace was judged against this profile's own recent shots. */
  baseline?: { medianGramsPerSecond: number; shots: number }
}

/**
 * Personal baseline. Calibrated on Tian's 89-shot history (Sep–Oct 2026, LRv3 and
 * Adaptive v3, fixed 18 g dose, ~1:2): at the same grind, shot time varied by
 * 8–11 % (CV) and consecutive shots by ~3 s. A ±20 % band around the profile's
 * own median weight flow is therefore about two standard deviations: only a
 * genuinely fast or slow shot is called fast or slow, not ordinary prep noise.
 */
export const BASELINE = { minimumShots: 8, fastRatio: 1.2, slowRatio: 0.82, keep: 40 } as const

export function paceAgainstBaseline(reading: PaceReading | undefined, history: number[] | undefined): PaceReading | undefined {
  if (!reading || reading.pace === 'slow' && reading.gramsPerSecond <= PACE_THRESHOLDS.slowGramsPerSecond / 2) return reading
  const usable = (history ?? []).filter(value => Number.isFinite(value) && value > 0)
  if (usable.length < BASELINE.minimumShots) return reading
  const sorted = [...usable].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  const relative = reading.gramsPerSecond / median
  // A stall stays slow whatever the baseline says.
  const pace: ShotPace = reading.pace === 'slow' && reading.gramsPerSecond <= PACE_THRESHOLDS.slowGramsPerSecond ? 'slow' : relative >= BASELINE.fastRatio ? 'fast' : relative <= BASELINE.slowRatio ? 'slow' : 'normal'
  return { ...reading, pace, baseline: { medianGramsPerSecond: median, shots: usable.length } }
}

export function shotPace(points: LiveShotPoint[], analysis?: Pick<ShotAnalysis, 'findings' | 'firstDropsMs' | 'pressurisedAtMs'>): PaceReading | undefined {
  if (!points.length) return undefined
  const finalYield = points.reduce((max, point) => typeof point.weight === 'number' && Number.isFinite(point.weight) ? Math.max(max, point.weight) : max, 0)
  if (finalYield < PACE_THRESHOLDS.minimumYieldGrams) return undefined
  const firstDrops = analysis?.firstDropsMs ?? points.find(point => (point.weight ?? 0) >= 1)?.elapsedMs ?? analysis?.pressurisedAtMs
  if (firstDrops === undefined) return undefined
  // End = the moment the cup stopped gaining weight, so a long drip-out after the stop doesn't count.
  const lastGain = [...points].reverse().find(point => (point.weight ?? 0) >= finalYield - 0.3)
  const contactMs = (lastGain?.elapsedMs ?? points.at(-1)!.elapsedMs) - firstDrops
  if (contactMs < PACE_THRESHOLDS.minimumContactMs) return undefined
  const gramsPerSecond = finalYield / (contactMs / 1000)
  const stalled = analysis ? hasFinding(analysis, 'chokedFlow') : false
  const pace: ShotPace = stalled || gramsPerSecond <= PACE_THRESHOLDS.slowGramsPerSecond ? 'slow' : gramsPerSecond >= PACE_THRESHOLDS.fastGramsPerSecond ? 'fast' : 'normal'
  return { pace, gramsPerSecond, contactMs }
}
