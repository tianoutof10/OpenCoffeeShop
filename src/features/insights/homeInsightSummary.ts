import { inWindow, shiftDate, summarize, type HistoryRecord } from './historyData.ts'

/** Pure seven-day summary, reusable until records or the local calendar day change. */
export function homeInsightSummary(records: HistoryRecord[], today: string) {
  const window = { start: shiftDate(today, -6), end: shiftDate(today, 1) }
  const shots = records.filter(record => record.beverage === 'espresso' && inWindow(record, window))
  const counts = new Map<string, number>()
  for (const shot of shots) counts.set(shot.date, (counts.get(shot.date) ?? 0) + 1)
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(window.start, index)
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
    return { date, weekday, count: counts.get(date) ?? 0 }
  })
  return { window, summary: summarize(shots), daily, max: Math.max(1, ...daily.map(day => day.count)) }
}
