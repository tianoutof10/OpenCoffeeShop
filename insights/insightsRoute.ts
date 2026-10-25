import { coversWindow, reportingWindow, type HistoryCache, type InsightFilter } from './historyData.ts'

export const insightPeriods = [7, 30, 180] as const
export interface InsightsRoute { section: 'overview' | 'history'; days: 0 | typeof insightPeriods[number]; beverage: 'espresso' | 'pourover' | 'other' | 'all'; filter: InsightFilter; search: string; previous: boolean; shotId: string | null }
export const defaultInsightsRoute: InsightsRoute = { section: 'overview', days: 7, beverage: 'espresso', filter: null, search: '', previous: false, shotId: null }
export function availableInsightPeriods(cache: HistoryCache | null, now = new Date()) {
  if (!cache) return insightPeriods.filter(days => days !== 180)
  const window = reportingWindow(180, cache.timezone, now)
  // An entirely fetched but young archive is not 180 days of brewing history.
  const oldEnough = cache.records.some(r => r.date <= window.start)
  return insightPeriods.filter(days => days !== 180 || oldEnough && coversWindow(cache, window))
}
export function constrainInsightsRoute(route: InsightsRoute, periods: readonly number[]): InsightsRoute {
  return route.days === 180 && !periods.includes(180) ? { ...route, days: 30, previous: false, filter: null } : route
}
const keys = ['insSection', 'insDays', 'insDrink', 'insKind', 'insValue', 'insSearch', 'insPrevious', 'shotId']
export function readInsightsRoute(params: URLSearchParams): InsightsRoute {
  const section = params.get('insSection') === 'history' || params.get('page') === 'previous-pull' ? 'history' : 'overview'
  // Preserve older bookmarked monthly views by mapping the former 28-day range.
  const requested = params.get('insDays') === '28' ? 30 : Number(params.get('insDays'))
  const days = insightPeriods.find(days => days === requested) ?? (section === 'history' && params.get('insDays') === '0' ? 0 : 7)
  const drink = params.get('insDrink')
  const kind = params.get('insKind')
  const value = params.get('insValue')
  const filter: InsightFilter = value && (kind === 'profile' || kind === 'weekday' && /^[0-6]$/.test(value) || kind === 'hours' && /^(?:[0-9]|1[01])$/.test(value)) ? { kind: kind as NonNullable<InsightFilter>['kind'], value } : null
  return { section, days, beverage: drink === 'pourover' || drink === 'other' || (section === 'history' && drink === 'all') ? drink : 'espresso', filter, search: params.get('insSearch') ?? '', previous: section === 'history' && days !== 0 && params.get('insPrevious') === '1', shotId: params.get('shotId') }
}
export function writeInsightsRoute(url: URL, route: InsightsRoute) {
  keys.forEach(key => url.searchParams.delete(key))
  url.searchParams.set('page', 'insights')
  url.searchParams.set('insSection', route.section)
  url.searchParams.set('insDays', String(route.days))
  url.searchParams.set('insDrink', route.beverage)
  if (route.filter) { url.searchParams.set('insKind', route.filter.kind); url.searchParams.set('insValue', route.filter.value) }
  if (route.search) url.searchParams.set('insSearch', route.search)
  if (route.previous) url.searchParams.set('insPrevious', '1')
  if (route.shotId) url.searchParams.set('shotId', route.shotId)
  return url
}
