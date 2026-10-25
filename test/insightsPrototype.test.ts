import assert from 'node:assert/strict'
import test from 'node:test'
import { records, getWindow, summarize, matches, observation, median, averageYield, timeWindows, timeWindowCounts, filterName } from '../review/brewing-insights/data.ts'

test('prototype windows partition current and earlier records without overlap', () => {
  for (const days of [7, 28]) {
    const current = getWindow(days), prior = getWindow(days, true)
    assert.ok(current.length > 0 && prior.length > 0)
    assert.equal(current.some(s => prior.some(p => p.id === s.id)), false)
    const total = summarize(current)
    assert.equal(total.weekdays.reduce((a, b) => a + b, 0), current.length)
    assert.equal(total.bands.reduce((a, b) => a + b, 0), current.length)
    assert.equal(total.profileCounts.reduce((a, b) => a + b.count, 0), current.length)
  }
  assert.equal(getWindow(28).length + getWindow(28, true).length, records.length)
})
test('entry average is an arithmetic mean, excluding missing and unusable readings', () => {
  const sample = records[0]
  assert.equal(averageYield([20, 20, 50, null].map(yieldValue => ({ ...sample, yield: yieldValue }))), 30)
  assert.equal(averageYield([]), null)
  assert.equal(averageYield([null, NaN, Infinity, -1].map(yieldValue => ({ ...sample, yield: yieldValue }))), null)
  assert.equal(averageYield([{ ...sample, yield: 0 }, { ...sample, yield: 40 }]), 20)
})
test('prototype filtering and insight evidence agree with aggregates', () => {
  const shots = getWindow(28), totals = summarize(shots)
  for (let day = 0; day < 7; day++) assert.equal(shots.filter(s => matches(s, { kind: 'weekday', value: String(day) })).length, totals.weekdays[day])
  for (let band = 0; band < 4; band++) assert.equal(shots.filter(s => matches(s, { kind: 'band', value: String(band) })).length, totals.bands[band])
  assert.ok(shots.filter(s => matches(s, observation(28).filter)).length > 0)
  assert.ok(totals.yieldCoverage < totals.count)
  assert.equal(median([]), null)
  assert.equal(median([36, 40]), 38)
})

test('time chart covers all 24 hours exactly once, including midnight and end-of-day', () => {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ ...records[0], hour, minute: 59 }))
  assert.equal(timeWindows.length, 12)
  assert.deepEqual(timeWindowCounts(hourly), Array(12).fill(2))
  assert.deepEqual(timeWindowCounts([]), Array(12).fill(0))
  assert.equal(filterName({ kind: 'hours', value: '0' }), '00:00–02:00 brews')
  assert.equal(filterName({ kind: 'hours', value: '11' }), '22:00–24:00 brews')
  assert.equal(matches({ ...records[0], hour: 2 }, { kind: 'hours', value: '0' }), false)
  assert.equal(matches({ ...records[0], hour: 2 }, { kind: 'hours', value: '1' }), true)
})

test('every time-chart count equals its drill-down in either reporting period', () => {
  for (const days of [7, 28]) for (const previous of [false, true]) {
    const shots = getWindow(days, previous)
    const counts = timeWindowCounts(shots)
    assert.equal(counts.reduce((sum, count) => sum + count, 0), shots.length)
    counts.forEach((count, index) => assert.equal(
      shots.filter(shot => matches(shot, { kind: 'hours', value: String(index) })).length, count))
  }
})
