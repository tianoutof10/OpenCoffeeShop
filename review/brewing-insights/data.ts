// Fictional records for the isolated design prototype. Never imported by the app.
export interface InsightShot {
  id: string
  date: string
  day: number
  weekday: number
  hour: number
  minute: number
  profile: string
  dose: number | null
  yield: number | null
  duration: number
}
export const profiles = ['Adaptive V2', 'Best practice light', 'Gentle & sweet']
export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const timeWindows = Array.from({ length: 12 }, (_, index) => ({
  start: index * 2,
  end: index * 2 + 2,
  label: `${String(index * 2).padStart(2, '0')}:00–${String(index * 2 + 2).padStart(2, '0')}:00`,
}))
export const timeWindowCounts = (shots: InsightShot[]) => timeWindows.map(window =>
  shots.filter(shot => shot.hour >= window.start && shot.hour < window.end).length)
export const bands = [
  { name: 'Morning', hours: '06:00–12:00', start: 6, end: 12 },
  { name: 'Afternoon', hours: '12:00–18:00', start: 12, end: 18 },
  { name: 'Evening', hours: '18:00–24:00', start: 18, end: 24 },
  { name: 'Overnight', hours: '00:00–06:00', start: 0, end: 6 },
]
export const records: InsightShot[] = Array.from({ length: 56 }, (_, day) => {
  const date = new Date(Date.UTC(2026, 6, 18 + day))
  const count = day % 13 === 0 ? 0 : day < 28 ? 1 + Number(day % 3 === 0) : 2 + Number(day % 5 === 0)
  return Array.from({ length: count }, (_, slot) => ({
    id: `sample-${day}-${slot}`, date: date.toISOString().slice(0, 10), day,
    weekday: (date.getUTCDay() + 6) % 7,
    hour: slot === 0 ? (date.getUTCDay() % 6 === 0 ? 9 : 7) : slot === 1 ? (day % 3 === 0 ? 14 : 10) : 17,
    minute: (day * 7 + slot * 11) % 60,
    profile: profiles[day >= 28 ? (day + slot) % 5 < 3 ? 0 : 1 + (day % 2) : (day + slot) % 3],
    dose: 20,
    yield: day % 11 === 0 && slot === 0 ? null : (day < 28 ? 35 : 38) + ((day + slot) % 5 - 2) * 0.6,
    duration: 42 + (day + slot) % 9,
  }))
}).flat()

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null
}
export const averageYield = (shots: InsightShot[]) => {
  const values = shots.flatMap(s => s.yield !== null && Number.isFinite(s.yield) && s.yield >= 0 ? [s.yield] : [])
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}
export const getWindow = (days: number, previous = false) => records.filter(s => s.day >= 56 - days * (previous ? 2 : 1) && s.day < 56 - (previous ? days : 0))
export function summarize(shots: InsightShot[]) {
  const profileCounts = profiles.map(name => ({ name, count: shots.filter(s => s.profile === name).length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    count: shots.length, days: new Set(shots.map(s => s.day)).size,
    typicalYield: median(shots.flatMap(s => s.yield === null ? [] : [s.yield])),
    yieldCoverage: shots.filter(s => s.yield !== null).length,
    duration: median(shots.map(s => s.duration)), profileCounts,
    weekdays: weekdays.map((_, i) => shots.filter(s => s.weekday === i).length),
    bands: bands.map(b => shots.filter(s => s.hour >= b.start && s.hour < b.end).length),
  }
}
export type ShotFilter = { kind: 'weekday' | 'band' | 'profile' | 'hours'; value: string } | null
export function matches(shot: InsightShot, filter: ShotFilter) {
  if (!filter) return true
  if (filter.kind === 'weekday') return shot.weekday === Number(filter.value)
  if (filter.kind === 'profile') return shot.profile === filter.value
  if (filter.kind === 'hours') {
    const window = timeWindows[Number(filter.value)]
    return !!window && shot.hour >= window.start && shot.hour < window.end
  }
  const band = bands[Number(filter.value)]
  return shot.hour >= band.start && shot.hour < band.end
}
export const filterName = (filter: ShotFilter) => !filter ? 'All brews' : filter.kind === 'profile' ? filter.value : filter.kind === 'hours' ? `${timeWindows[Number(filter.value)].label} brews` : filter.kind === 'weekday' ? `${weekdays[Number(filter.value)]} brews` : `${bands[Number(filter.value)].name} · ${bands[Number(filter.value)].hours}`
export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date))
export const timeLabel = (shot: InsightShot) => `${String(shot.hour).padStart(2, '0')}:${String(shot.minute).padStart(2, '0')}`
export function periodLabel(days: number, previous = false) {
  const start = new Date(Date.UTC(2026, 6, 18 + 56 - days * (previous ? 2 : 1)))
  const end = new Date(Date.UTC(2026, 6, 18 + 55 - (previous ? days : 0)))
  return `${dateLabel(start.toISOString())} – ${dateLabel(end.toISOString())}`
}
export function observation(days: number) {
  const current = summarize(getWindow(days)), previous = summarize(getWindow(days, true))
  if (current.count >= 10 && previous.count >= 10) {
    const shifts = current.profileCounts.map(p => ({ ...p, before: previous.profileCounts.find(x => x.name === p.name)!.count / previous.count * 100, share: p.count / current.count * 100 }))
      .filter(p => p.count >= 5 && p.share - p.before >= 15).sort((a, b) => (b.share - b.before) - (a.share - a.before))
    if (shifts.length) {
      const p = shifts[0]
      return { title: 'A new go-to is taking shape.', body: `${p.name} now appears in ${Math.round(p.share)}% of your brews, up from ${Math.round(p.before)}%.`, evidence: `${p.count} of ${current.count} brews · compared with ${previous.count} earlier brews`, filter: { kind: 'profile', value: p.name } as ShotFilter, compare: true }
    }
  }
  const top = current.bands.indexOf(Math.max(...current.bands))
  if (current.count >= 5 && current.bands[top] / current.count >= 0.6) return { title: 'A familiar brewing ritual.', body: `${current.bands[top]} of ${current.count} brews were in the ${bands[top].name.toLowerCase()}.`, evidence: `Based on ${current.count} recorded brews`, filter: { kind: 'band', value: String(top) } as ShotFilter, compare: false }
  return { title: 'Your routine, at a glance.', body: `You brewed on ${current.days} of the last ${days} days.`, evidence: `${current.count} recorded brews`, filter: null, compare: false }
}
