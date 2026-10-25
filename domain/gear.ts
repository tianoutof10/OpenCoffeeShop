/**
 * The barista's physical setup and flavour goal. Used to adapt analysis
 * thresholds, starting recipes, and advice wording (grinder-native steps).
 * See docs/shot-analysis-and-dial-in.md.
 */
export type BurrClass = 'conical' | 'bimodalFlat' | 'unimodalFlat'
export type BasketKind = 'standard' | 'highExtraction'
/** "Modern Clarity" vs "Traditional Body": decides how a sour cup is resolved. */
export type BrewStyle = 'clarity' | 'body'

export interface GearSetup {
  grinderName?: string
  burrs?: BurrClass
  /** How far one "step" of advice moves the grinder, in its own units (e.g. 1 notch, 0.5 marks). */
  grindStepSize?: number
  /** The grinder's own unit word, e.g. "notch", "mark", "click". */
  grindUnit?: string
  basket?: BasketKind
  basketDoseGrams?: number
  /** The barista keeps the dose the same every shot: advice never changes it. */
  fixedDose?: boolean
  bottomPaperFilter?: boolean
  puckScreen?: boolean
  /** Water alkalinity (KH) in ppm as CaCO₃. */
  waterAlkalinityPpm?: number
  style: BrewStyle
}

export const DEFAULT_GEAR: GearSetup = { style: 'clarity', basket: 'standard', grindStepSize: 1 }
export const HIGH_ALKALINITY_PPM = 80

const finitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

export function normalizeGear(value: unknown): GearSetup {
  const candidate = value && typeof value === 'object' ? value as Partial<GearSetup> : {}
  const text = (input: unknown) => typeof input === 'string' && input.trim() ? input.trim().slice(0, 80) : undefined
  return {
    grinderName: text(candidate.grinderName),
    burrs: candidate.burrs === 'conical' || candidate.burrs === 'bimodalFlat' || candidate.burrs === 'unimodalFlat' ? candidate.burrs : undefined,
    grindStepSize: finitePositive(candidate.grindStepSize) ? Math.min(50, candidate.grindStepSize) : 1,
    grindUnit: text(candidate.grindUnit),
    basket: candidate.basket === 'highExtraction' ? 'highExtraction' : 'standard',
    basketDoseGrams: finitePositive(candidate.basketDoseGrams) ? Math.min(30, candidate.basketDoseGrams) : undefined,
    fixedDose: candidate.fixedDose === true,
    bottomPaperFilter: candidate.bottomPaperFilter === true,
    puckScreen: candidate.puckScreen === true,
    waterAlkalinityPpm: typeof candidate.waterAlkalinityPpm === 'number' && Number.isFinite(candidate.waterAlkalinityPpm) && candidate.waterAlkalinityPpm >= 0 ? Math.min(500, candidate.waterAlkalinityPpm) : undefined,
    style: candidate.style === 'body' ? 'body' : 'clarity',
  }
}

/**
 * Analysis threshold adjustments for the setup. A bottom paper filter lets the
 * bed flow faster without a channel, so an abrupt drop must be larger to count.
 */
export function analysisOverridesForGear(gear: GearSetup | undefined) {
  if (!gear) return {}
  return {
    ...(gear.bottomPaperFilter ? { suddenDropFraction: 0.45, strongDropFraction: 0.6 } : {}),
    // A puck screen absorbs a few millilitres before the bed is touched.
    ...(gear.puckScreen ? { settleMs: 1_500 } : {}),
  }
}

/** The grind setting one step finer (−1) or coarser (+1), when the current setting is numeric. */
export function nextGrindSetting(current: string | undefined, direction: 1 | -1, gear: GearSetup | undefined) {
  if (current === undefined) return undefined
  const value = Number(String(current).replace(',', '.'))
  if (!Number.isFinite(value) || String(current).trim() === '' || current === '—') return undefined
  const step = gear?.grindStepSize ?? 1
  const decimals = Math.max((String(step).split('.')[1] ?? '').length, (String(current).replace(',', '.').split('.')[1] ?? '').length)
  return Math.max(0, Number((value + direction * step).toFixed(decimals)))
}

export const waterIsHighlyBuffered = (gear: GearSetup | undefined) => (gear?.waterAlkalinityPpm ?? 0) > HIGH_ALKALINITY_PPM
