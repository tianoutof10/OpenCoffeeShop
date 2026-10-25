import assert from 'node:assert/strict'
import test from 'node:test'
import { homeInsightSummary } from '../src/features/insights/homeInsightSummary.ts'
import { calendarParts, inWindow, reportingWindow, summarize, type HistoryRecord } from '../src/features/insights/historyData.ts'

const records = [
  ['2026-09-12', 'espresso', 30], ['2026-09-13', 'espresso', 35], ['2026-09-19', 'espresso', 40],
  ['2026-09-19', 'espresso', null], ['2026-09-19', 'excluded', 60], ['2026-09-19', 'pourover', 200], ['2026-09-20', 'espresso', 50],
].map(([date, beverage, yieldValue], index) => ({ id: String(index), date, beverage, yield: yieldValue, profile: 'Test', profileKey: 'test', weekday: 0 })) as HistoryRecord[]

test('home summary retains eligibility, measured-yield coverage and today on the right', () => {
  const now = new Date('2026-09-19T12:00:00Z')
  const result = homeInsightSummary(records, '2026-09-19')
  const window = reportingWindow(7, 'UTC', now, false, true)
  assert.deepEqual(result.window, window)
  assert.deepEqual(result.summary, summarize(records.filter(r => r.beverage === 'espresso' && inWindow(r, window))))
  assert.equal(result.summary.count, 3)
  assert.equal(result.summary.yieldCoverage, 2)
  assert.equal(result.summary.averageYield, 37.5)
  assert.equal(result.daily.at(-1)?.date, '2026-09-19')
  assert.equal(result.daily.at(-1)?.count, 2)
})

test('new records, midnight, empty history and timezone boundaries refresh the right summary', () => {
  assert.equal(homeInsightSummary([], '2026-09-19').max, 1)
  assert.equal(homeInsightSummary([...records, records[2]], '2026-09-19').summary.count, 4)
  const today = calendarParts('2026-09-19T23:30:00Z', 'Asia/Singapore')!.date
  assert.equal(today, '2026-09-20')
  const next = homeInsightSummary(records, today)
  assert.equal(next.daily.at(-1)?.weekday, 6)
  assert.equal(next.daily.at(-1)?.date, today)
  assert.equal(next.daily[0].count, 0)
})
