import { clockOptions, type ClockFormat } from '../sleep/deviceTime.ts'
import { dateFormatter, formatNumber, hasLocalizedMessage, t } from '../../i18n/index.ts'
import { shiftDate } from './historyData.ts'

export function insightHour(hour: number, format: ClockFormat, minor = false, locales?: Intl.LocalesArgument) {
  const twelve = new Intl.DateTimeFormat(locales, { hour: 'numeric', ...clockOptions(format) }).resolvedOptions().hour12
  const normalized = ((hour % 24) + 24) % 24
  if (!twelve || minor) return formatNumber(twelve ? normalized % 12 || 12 : normalized, { useGrouping: false })
  // Let Intl place the day period: e.g. "3 pm" versus "下午3时".
  return dateFormatter({ hour: 'numeric', hourCycle: 'h12', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, 1, normalized))).toLowerCase().replace(/[\u00a0\u202f]/g, ' ')
}
export const insightHourRange = (index: number, format: ClockFormat) =>
  `${insightHour(index * 2, format)}–${insightHour(index * 2 + 2, format)}`
/** Use the same exclusive-end windows as the charts, not dates of available shots. */
export function insightPeriods(current: { start: string; end: string }, previous: { start: string; end: string }): [string, string] {
  const windows = [current, previous].map(window => ({ start: window.start, end: shiftDate(window.end, -1) }))
  const showYear = new Set(windows.flatMap(window => [window.start.slice(0, 4), window.end.slice(0, 4)])).size > 1
  // Preserve the already-reviewed compact patterns in English/German. New
  // partial catalogs must not accidentally inherit those patterns via fallback.
  if (hasLocalizedMessage('insights.period.dayMonth') && hasLocalizedMessage('insights.period.dayOnly')) {
    const month = (date: string) => dateFormatter({ day: 'numeric', month: 'short', timeZone: 'UTC' }).formatToParts(new Date(`${date}T12:00:00Z`)).find(part => part.type === 'month')?.value ?? ''
    const full = (date: string) => `${t('insights.period.dayMonth', { day: Number(date.slice(8, 10)), month: month(date) })}${showYear ? ` ${date.slice(0, 4)}` : ''}`
    return windows.map(({ start, end }) => start === end ? full(start)
      : start.slice(0, 7) === end.slice(0, 7) ? `${t('insights.period.dayOnly', { day: Number(start.slice(8, 10)) })}–${full(end)}`
        : `${full(start)}–${full(end)}`) as [string, string]
  }
  // Dates must not inherit English sentence order when a partial catalog falls
  // back. Intl owns month/day/year order, range punctuation and repeated fields.
  const formatter = dateFormatter({ day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC' })
  const date = (value: string) => new Date(`${value}T12:00:00Z`)
  return windows.map(({ start, end }) => start === end ? formatter.format(date(start))
    : typeof formatter.formatRange === 'function' ? formatter.formatRange(date(start), date(end))
      : `${formatter.format(date(start))}–${formatter.format(date(end))}`) as [string, string]
}
export const toggleHour = (selected: number | null, index: number) => selected === index ? null : index
