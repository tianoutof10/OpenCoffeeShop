import assert from 'node:assert/strict'
import test from 'node:test'
import { insightHour, insightHourRange, insightPeriods, toggleHour } from '../src/features/insights/insightClock.ts'
import { clockPoint, coxcombSector } from '../src/features/insights/coxcomb.ts'
import { reportingWindow } from '../src/features/insights/historyData.ts'

const periods = (days: number, now: string, timezone = 'UTC') => insightPeriods(
  reportingWindow(days, timezone, new Date(now), false, true),
  reportingWindow(days, timezone, new Date(now), true, true),
)
test('insight labels use inclusive dates from the actual rolling chart windows', () => {
  const now = '2026-09-16T12:00:00Z'
  assert.deepEqual(periods(7, now), ['10–16 Sep', '3–9 Sep'])
  assert.deepEqual(periods(30, now), ['18 Aug–16 Sep', '19 Jul–17 Aug'])
  assert.deepEqual(periods(180, now), ['21 Mar 2026–16 Sep 2026', '22 Sep 2025–20 Mar 2026'])
})
test('date legends handle year boundaries, leap days, and the reporting timezone', () => {
  assert.deepEqual(periods(7, '2026-01-03T12:00:00Z'), ['28 Dec 2025–3 Jan 2026', '21–27 Dec 2025'])
  assert.deepEqual(periods(7, '2024-03-02T12:00:00Z'), ['25 Feb–2 Mar', '18–24 Feb'])
  assert.deepEqual(periods(7, '2026-09-16T23:30:00Z', 'Asia/Singapore'), ['11–17 Sep', '4–10 Sep'])
  assert.deepEqual(periods(7, '2026-09-16T23:30:00Z', 'America/Los_Angeles'), ['10–16 Sep', '3–9 Sep'])
})
test('hour labels honor explicit and device clock preferences', () => {
  assert.equal(insightHour(0, '12h'), '12 am')
  assert.equal(insightHour(12, '12h'), '12 pm')
  assert.equal(insightHour(18, '12h'), '6 pm')
  assert.equal(insightHour(15, '12h', true), '3')
  assert.equal(insightHour(21, '12h', true), '9')
  for (const hour of [0, 3, 6, 9, 12, 15, 18, 21]) assert.equal(insightHour(hour, '24h'), String(hour))
  assert.equal(insightHour(15, 'device', false, 'en-US'), '3 pm')
  assert.equal(insightHour(15, 'device', false, 'en-GB'), '15')
  assert.equal(insightHourRange(11, '12h'), '10 pm–12 am')
  assert.equal(insightHourRange(11, '24h'), '22–0')
})
test('noon is above midnight and sectors rotate with their labels', () => {
  assert.ok(clockPoint(12 * 15 + 180, 100)[1] < 136)
  assert.ok(clockPoint(180, 100)[1] > 136)
  assert.match(coxcombSector(0, 102, 0), /^M 136\.000 168\.000 L 136\.000 238\.000/)
})
test('reselecting the same hour clears it', () => {
  assert.equal(toggleHour(null, 4), 4)
  assert.equal(toggleHour(4, 4), null)
  assert.equal(toggleHour(4, 5), 5)
})
