import { daysOffRoast, type Bean } from '../../domain/beans.ts'
import { nextGrindSetting, type GearSetup } from '../../domain/gear.ts'
import { distanceFromTarget, isOnTarget, TASTE_ZONES } from '../insights/dialIn.ts'
import type { CoffeeLibrary, DialEntry, PinnedRecipe } from './coffeeLibrary.ts'

/**
 * A bag's dial-in as a journey: each tasted shot is a point on the taste square.
 * Two shots in a row on target means stop: this is the recipe. Endless tweaking
 * is a failure mode, so the app says so.
 */
export type JourneyStatus = 'empty' | 'started' | 'converging' | 'wandering' | 'dialedIn'

export interface Journey {
  entries: DialEntry[]
  status: JourneyStatus
  /** 1-based shot number of the first shot of the closing on-target pair. */
  dialedInAt?: number
}

const asNote = (entry: DialEntry) => ({ extraction: entry.extraction, strength: entry.strength, finish: entry.finish, milk: entry.milk })

export function journeyFor(library: Pick<CoffeeLibrary, 'dialLog'>, beanId: string | undefined): Journey {
  const entries = beanId ? [...(library.dialLog[beanId] ?? [])].sort((left, right) => left.at.localeCompare(right.at)) : []
  if (!entries.length) return { entries, status: 'empty' }
  const last = entries.at(-1)!, previous = entries.at(-2)
  if (previous && isOnTarget(asNote(last)) && isOnTarget(asNote(previous))) return { entries, status: 'dialedIn', dialedInAt: entries.length - 1 }
  if (!previous) return { entries, status: 'started' }
  return { entries, status: distanceFromTarget(asNote(last)) < distanceFromTarget(asNote(previous)) - 0.05 || isOnTarget(asNote(last)) ? 'converging' : 'wandering' }
}

/** The recipe of a shot entry, ready to pin. */
export const recipeFromEntry = (entry: DialEntry): Omit<PinnedRecipe, 'pinnedAt'> => ({ profileId: entry.profileId, profileName: entry.profileName, dose: entry.dose, yield: entry.yield, grindSetting: entry.grindSetting, temperatureC: entry.temperatureC, beanAgeDays: entry.beanAgeDays })

const sameCoffee = (left: Bean, right: Bean) => {
  const norm = (value?: string) => value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
  return norm(left.name) === norm(right.name) && norm(left.roaster) === norm(right.roaster)
}

export type BeanRecipe =
  | { source: 'pinned'; recipe: PinnedRecipe }
  | { source: 'previousBag'; recipe: PinnedRecipe; fromBean: Bean }

/** Where today's recipe comes from: this bag's pin, or the last bag of the same coffee. */
export function recipeForBean(library: Pick<CoffeeLibrary, 'beans' | 'pinned'>, bean: Bean | undefined): BeanRecipe | undefined {
  if (!bean) return undefined
  const own = library.pinned[bean.id]
  if (own) return { source: 'pinned', recipe: own }
  const previous = library.beans
    .filter(candidate => candidate.id !== bean.id && library.pinned[candidate.id] && sameCoffee(candidate, bean))
    .sort((left, right) => library.pinned[right.id]!.pinnedAt.localeCompare(library.pinned[left.id]!.pinnedAt))[0]
  return previous ? { source: 'previousBag', recipe: library.pinned[previous.id]!, fromBean: previous } : undefined
}

export const DRIFT = { daysSincePin: 10 } as const

export interface DriftAdvice { daysSincePin: number; toSetting?: number; fromSetting?: string }

/**
 * As a bag ages it loses CO₂ and extracts faster: the same grind runs quicker and
 * tastes thinner. Ten days after pinning, suggest one step finer before the
 * drift is tasted.
 */
export function driftAdvice(bean: Bean | undefined, pinned: PinnedRecipe | undefined, gear: GearSetup, now = new Date()): DriftAdvice | undefined {
  if (!bean || !pinned) return undefined
  const pinnedDay = new Date(pinned.pinnedAt)
  if (Number.isNaN(pinnedDay.getTime())) return undefined
  const daysSincePin = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(pinnedDay.getFullYear(), pinnedDay.getMonth(), pinnedDay.getDate())) / 86_400_000)
  if (daysSincePin < DRIFT.daysSincePin) return undefined
  const age = daysOffRoast(bean, now)
  if (age !== undefined && age < 10) return undefined
  const toSetting = nextGrindSetting(pinned.grindSetting, -1, gear)
  return { daysSincePin, ...(toSetting !== undefined ? { toSetting, fromSetting: pinned.grindSetting } : {}) }
}

/** For plotting: the target point moves up the square for milk drinks. */
export const targetFor = (milk: boolean | undefined) => ({ extraction: 0, strength: milk ? TASTE_ZONES.milkShift : 0 })
