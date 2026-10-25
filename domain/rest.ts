import { daysOffRoast, type Bean, type RoastLevel } from './beans.ts'

/**
 * How a bag is resting. Light roasts need longer to degas and open up; dark
 * roasts peak early and fade sooner. Windows are deliberately broad: they are
 * guidance for expectations ("don't chase it today"), not rules.
 */
export type RestPhase = 'tooFresh' | 'opening' | 'peak' | 'fading'

export interface RestWindow { openFrom: number; peakFrom: number; peakTo: number }

export const REST_WINDOWS: Record<RoastLevel, RestWindow> = {
  light: { openFrom: 7, peakFrom: 14, peakTo: 35 },
  medium: { openFrom: 5, peakFrom: 8, peakTo: 28 },
  dark: { openFrom: 3, peakFrom: 5, peakTo: 21 },
}

export interface RestState {
  days: number
  phase: RestPhase
  window: RestWindow
  roast: RoastLevel
  /** Days until the bag reaches its best window (opening/tooFresh only). */
  daysToPeak?: number
}

export function restState(bean: Pick<Bean, 'roastDate' | 'roastLevel'> | undefined, now = new Date()): RestState | undefined {
  const days = daysOffRoast(bean, now)
  if (days === undefined) return undefined
  const roast = bean?.roastLevel ?? 'medium'
  const window = REST_WINDOWS[roast]
  const phase: RestPhase = days < window.openFrom ? 'tooFresh' : days < window.peakFrom ? 'opening' : days <= window.peakTo ? 'peak' : 'fading'
  return { days, phase, window, roast, ...(days < window.peakFrom ? { daysToPeak: window.peakFrom - days } : {}) }
}
