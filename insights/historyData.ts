import type { PaginatedShots, ShotRecord } from '../../api/decaid/types.ts'
import type { PreviousShot } from '../../domain/brewing.ts'
import { dateFormatter, formatDecimal, localizeDecimalText, t } from '../../i18n/index.ts'

export const HISTORY_LIMIT = 1000
export const HISTORY_PAGE_SIZE = 100
// Monday=0..Sunday=6, matching HistoryRecord.weekday. 2024-01-01 was a Monday, so it
// anchors a reference week; the actual year never appears in the formatted output.
const weekdayReference = (index: number) => new Date(Date.UTC(2024, 0, 1 + index))
export const weekdayShort = (index: number) => dateFormatter({ weekday: 'short', timeZone: 'UTC' }).format(weekdayReference(index))
export const weekdayNarrow = (index: number) => dateFormatter({ weekday: 'narrow', timeZone: 'UTC' }).format(weekdayReference(index))
export const timeWindows = Array.from({ length: 12 }, (_, i) => ({ start: i * 2, end: i * 2 + 2, label: `${String(i * 2).padStart(2, '0')}:00–${String(i * 2 + 2).padStart(2, '0')}:00` }))
export type Beverage = 'espresso' | 'pourover' | 'other' | 'excluded'
export interface HistoryRecord {
  profileNameMissing?: boolean
  id: string; timestamp: string; profile: string; profileKey: string; beverage: Beverage
  dose: number | null; yield: number | null; duration: number | null
  signature: string; date: string; weekday: number; hour: number; minute: number
  durationReconciled?: 1
}
export interface HistoryCache {
  version: 1; source: string; timezone: string; syncedAt: string; total: number
  fullSyncedAt?: string
  records: HistoryRecord[]; details: Record<string, PreviousShot>; omitted: number
}
export type InsightFilter = { kind: 'weekday' | 'hours' | 'profile'; value: string } | null
export const finiteMetric = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
// Full snapshots still identify edits for cached-detail invalidation, not profile usage.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
function identityKey(value: unknown) {
  const text = canonical(value)
  let a = 2166136261, b = 5381
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i) }
  return `profile-${text.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`
}
// Saved Decaid workflows contain a recipe, not its library/lineage ID. For usage,
// group exact names within a drink type; keep named variants such as "(x)" intact.
export function profileUsageKey(name: string, beverage: Beverage) {
  return identityKey({ name: name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase(), beverage })
}
export function regroupHistory(cache: HistoryCache): HistoryCache {
  const records = cache.records.map(r => ({ ...r, profileKey: profileUsageKey(r.profile, r.beverage) }))
  return records.some((r, i) => r.profileKey !== cache.records[i].profileKey) ? { ...cache, records } : cache
}
export const savedDuration = (detail?: PreviousShot): number | null => {
  const text = detail?.totalTime?.trim()
  return text ? finiteMetric(Number(text)) : null
}
// Reconcile offline metadata before publishing the cache to the UI. Never
// fetch graphs here or use a recipe's planned time as a measured duration.
export function reconcileCachedDurations(cache: HistoryCache): HistoryCache {
  let changed = false
  const records = cache.records.map(record => {
    const detail = cache.details[record.id]
    const duration = finiteMetric(record.duration) ?? (detail?.id === record.id ? savedDuration(detail) : null)
    if (duration === record.duration) return record
    changed = true
    return { ...record, duration }
  })
  return changed ? { ...cache, records } : cache
}
export function calendarParts(timestamp: string, timezone: string) {
  const ms = Date.parse(timestamp)
  if (!Number.isFinite(ms)) return null
  // Older Decaid builds serialize machine-local timestamps without an offset.
  const bare = timestamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))
  const part = (name: string) => parts.find(p => p.type === name)!.value
  const date = bare?.[1] ?? `${part('year')}-${part('month')}-${part('day')}`
  return { date, hour: Number(bare?.[2] ?? part('hour')), minute: Number(bare?.[3] ?? part('minute')), weekday: (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 }
}
export function normalizeShot(shot: ShotRecord, timezone: string): HistoryRecord | null {
  if (typeof shot.id !== 'string' || !shot.id || typeof shot.timestamp !== 'string') return null
  const parts = calendarParts(shot.timestamp, timezone)
  if (!parts) return null
  const profile = shot.workflow?.profile
  const type = profile?.beverage_type?.trim().toLowerCase()
  const explicitlyExcluded = [shot.annotations?.extras, shot.metadata].some(extras => extras?.simulated === true || extras?.isSimulated === true || extras?.discarded === true || extras?.aborted === true)
  const excluded = ['cleaning', 'calibrate', 'calibration'].includes(type ?? '') || profile?.category?.trim().toLowerCase() === 'cleaning'
    || explicitlyExcluded
  const beverage: Beverage = excluded ? 'excluded' : type === 'espresso' ? 'espresso' : type === 'pourover' ? 'pourover' : 'other'
  const authoredName = profile?.title?.trim() || shot.workflow?.name?.trim()
  const name = authoredName || 'Unknown profile'
  return { id: shot.id, timestamp: shot.timestamp, ...parts,
    profile: name,
    ...(!authoredName ? { profileNameMissing: true } : {}),
    profileKey: profileUsageKey(name, beverage), beverage,
    dose: finiteMetric(shot.annotations?.actualDoseWeight) ?? finiteMetric(shot.workflow?.context?.targetDoseWeight) ?? finiteMetric(profile?.dose_weight),
    yield: finiteMetric(shot.annotations?.actualYield), duration: null,
    signature: canonical({ timestamp: shot.timestamp, workflow: shot.workflow, annotations: shot.annotations, stopReason: shot.stopReason, metadata: shot.metadata }),
  }
}
export function reconcileHistory(page: PaginatedShots, previous: HistoryCache | null, source: string, timezone: string, now = new Date()): HistoryCache {
  if (!page || !Array.isArray(page.items) || !Number.isInteger(page.total) || page.total < 0 || page.offset !== 0 || page.items.length > HISTORY_LIMIT || page.total < page.items.length || (page.total > 0 && !page.items.length)) throw new Error(t('common.error.incompleteHistory'))
  const prior = previous?.source === source ? previous : null
  const records = page.items.map(s => normalizeShot(s, timezone)).filter((s): s is HistoryRecord => s !== null)
  if (new Set(records.map(s => s.id)).size !== records.length) throw new Error(t('common.error.duplicateShots'))
  records.sort((a, b) => b.date.localeCompare(a.date) || b.hour - a.hour || b.minute - a.minute || Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id.localeCompare(a.id))
  return retainHistoryDetails({ version: 1, source, timezone, syncedAt: now.toISOString(), fullSyncedAt: now.toISOString(), total: page.total, omitted: page.items.length - records.length, records, details: {} }, prior)
}
// Also used at commit time, so a graph opened during a multi-page sync is retained.
export function retainHistoryDetails(cache: HistoryCache, previous: HistoryCache | null): HistoryCache {
  const prior = previous?.source === cache.source ? previous : null
  const index = new Map(prior?.records.map(r => [r.id, r]))
  const details: Record<string, PreviousShot> = Object.create(null)
  const records = cache.records.map(record => {
    const old = index.get(record.id)
    if (old?.signature === record.signature && prior) {
      const detail = prior.details[record.id]
      if (detail?.id === record.id) details[record.id] = detail
      return { ...record, duration: finiteMetric(old.duration) ?? (detail?.id === record.id ? savedDuration(detail) : null), durationReconciled: old.durationReconciled, yield: record.yield ?? old.yield }
    }
    return record
  })
  return { ...cache, records, details }
}
export function mergeRecentHistory(page: PaginatedShots, prior: HistoryCache, now: Date): HistoryCache | null {
  if (prior.omitted || prior.records.length !== Math.min(HISTORY_LIMIT, prior.total)) return null
  const added = page.total - prior.total
  // Only prepend provably new records; deletions, gaps and large imports need a full scan.
  if (added < 0 || added >= page.items.length) return null
  const ids = new Set(prior.records.map(r => r.id))
  if (page.items.slice(0, added).some(r => typeof r.id !== 'string' || ids.has(r.id))) return null
  if (!page.items.slice(added).every((r, i) => r.id === prior.records[i]?.id)) return null
  const head = page.items.map(r => normalizeShot(r, prior.timezone))
  if (head.some(r => r === null)) return null
  const records = [...head as HistoryRecord[], ...prior.records.slice(head.length - added)].slice(0, HISTORY_LIMIT)
  return retainHistoryDetails({ ...prior, records, total: page.total, syncedAt: now.toISOString() }, prior)
}
export function attachDetail(cache: HistoryCache, id: string, signature: string, detail: PreviousShot): HistoryCache {
  if (detail.id !== id || !cache.records.some(r => r.id === id && r.signature === signature)) return cache
  return { ...cache, records: cache.records.map(r => r.id !== id ? r : { ...r, duration: detail.totalTime === '—' ? null : finiteMetric(Number(detail.totalTime)), yield: r.yield ?? (detail.totalYield === '—' ? null : finiteMetric(Number(detail.totalYield))) }), details: { ...cache.details, [id]: detail } }
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function reportingWindow(days: number, timezone: string, now = new Date(), previous = false, includeToday = false) {
  const today = calendarParts(now.toISOString(), timezone)!.date
  const end = includeToday ? shiftDate(today, 1) : today
  return { start: shiftDate(end, -days * (previous ? 2 : 1)), end: shiftDate(end, previous ? -days : 0) }
}
export function rollingWeekdays(timezone: string, now = new Date()) {
  const today = calendarParts(now.toISOString(), timezone)!.weekday
  return Array.from({ length: 7 }, (_, offset) => (today + offset + 1) % 7)
}
export const inWindow = (r: HistoryRecord, w: { start: string; end: string }) => r.date >= w.start && r.date < w.end
export function coversWindow(cache: HistoryCache | null, w: { start: string; end: string }, throughToday?: Date) {
  const today = cache && throughToday ? calendarParts(throughToday.toISOString(), cache.timezone)!.date : null
  const requiredEnd = today && w.end === shiftDate(today, 1) ? today : w.end
  if (!cache || cache.omitted || calendarParts(cache.syncedAt, cache.timezone)!.date < requiredEnd) return false
  if (cache.total === cache.records.length) return true
  const earliest = cache.records.map(r => r.date).sort()[0]
  // The oldest cached calendar day may be cut in half by the record limit.
  return !!earliest && earliest < w.start
}
export const median = (values: number[]) => { const sorted = values.filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b); return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null }
export function summarize(shots: HistoryRecord[]) {
  const yields = shots.flatMap(r => r.yield === null ? [] : [r.yield])
  const profileMap = new Map<string, { key: string; name: string; count: number }>()
  shots.forEach(r => { const p = profileMap.get(r.profileKey); if (p) p.count++; else profileMap.set(r.profileKey, { key: r.profileKey, name: historyProfileName(r), count: 1 }) })
  return { count: shots.length, days: new Set(shots.map(r => r.date)).size, yieldCoverage: yields.length,
    typicalYield: yields.length >= 5 ? median(yields) : null, averageYield: yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null,
    profileCounts: [...profileMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    weekdays: Array.from({ length: 7 }, (_, i) => shots.filter(s => s.weekday === i).length) }
}
export const timeWindowCounts = (shots: HistoryRecord[]) => timeWindows.map(w => shots.filter(s => s.hour >= w.start && s.hour < w.end).length)
export function historyProfileName(record: Pick<HistoryRecord, 'profile' | 'profileNameMissing' | 'signature'>): string {
  if (record.profileNameMissing) return t('insights.profile.unknown')
  // Migrate display of old generated fallbacks only when the original snapshot proves it.
  if (record.profile === 'Unknown profile' && record.signature) {
    try {
      const saved = JSON.parse(record.signature)
      if (saved.workflow && !saved.workflow.profile?.title?.trim() && !saved.workflow.name?.trim()) return t('insights.profile.unknown')
    } catch { /* Authored/uncertain names remain unchanged. */ }
  }
  return record.profile
}
export const matches = (r: HistoryRecord, f: InsightFilter) => !f || (f.kind === 'weekday' ? r.weekday === Number(f.value) : f.kind === 'profile' ? r.profileKey === f.value : r.hour >= Number(f.value) * 2 && r.hour < Number(f.value) * 2 + 2)
export const dateLabel = (date: string, includeYear = false) => dateFormatter({ month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`))
export const timeLabel = (r: HistoryRecord) => `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
export const shotRecipeLabel = (r: Pick<HistoryRecord, 'dose' | 'yield' | 'duration'>) => `${r.dose !== null ? `${localizeDecimalText(String(r.dose))} → ` : ''}${r.yield !== null ? `${formatDecimal(r.yield, 1)} g` : '—'} • ${r.duration !== null ? localizeDecimalText(String(r.duration)) : '—'}s`

export function validHistoryCache(value: unknown, source: string): value is HistoryCache {
  if (!plain(value) || value.version !== 1 || value.source !== source || typeof value.timezone !== 'string' || typeof value.syncedAt !== 'string' || !Number.isFinite(Date.parse(value.syncedAt)) || !Number.isInteger(value.total) || !Number.isInteger(value.omitted) || !Array.isArray(value.records) || value.records.length > HISTORY_LIMIT || !plain(value.details)) return false
  if (value.fullSyncedAt !== undefined && (typeof value.fullSyncedAt !== 'string' || !Number.isFinite(Date.parse(value.fullSyncedAt)))) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format() } catch { return false }
  if ((value.total as number) < value.records.length || (value.omitted as number) < 0) return false
  const metric = (v: unknown) => v === null || finiteMetric(v) !== null
  const records = value.records
  if (!records.every(r => plain(r) && typeof r.id === 'string' && r.id && typeof r.timestamp === 'string' && Number.isFinite(Date.parse(r.timestamp)) && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && typeof r.profile === 'string' && typeof r.profileKey === 'string' && typeof r.signature === 'string' && ['espresso', 'pourover', 'other', 'excluded'].includes(r.beverage as string) && metric(r.dose) && metric(r.yield) && metric(r.duration) && Number.isInteger(r.weekday) && Number(r.weekday) >= 0 && Number(r.weekday) < 7 && Number.isInteger(r.hour) && Number(r.hour) >= 0 && Number(r.hour) < 24 && Number.isInteger(r.minute) && Number(r.minute) >= 0 && Number(r.minute) < 60)) return false
  const ids = new Set(records.map(r => r.id))
  if (ids.size !== records.length) return false
  return Object.entries(value.details).every(([id, detail]) => ids.has(id) && plain(detail) && detail.id === id && typeof detail.profileName === 'string' && typeof detail.totalTime === 'string' && typeof detail.totalYield === 'string' && (!detail.points || Array.isArray(detail.points)))
}
