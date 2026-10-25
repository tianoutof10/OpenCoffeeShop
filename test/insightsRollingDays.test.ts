import assert from 'node:assert/strict'
import test from 'node:test'
import { reportingWindow, rollingWeekdays, coversWindow, type HistoryCache } from '../src/features/insights/historyData.ts'
import { parseProfileTitle } from '../src/api/decaid/adapters.ts'

test('weekday columns wrap through Sunday and always finish with local today', () => {
  assert.deepEqual(rollingWeekdays('UTC', new Date('2026-09-14T12:00:00Z')), [1,2,3,4,5,6,0])
  assert.deepEqual(rollingWeekdays('UTC', new Date('2026-09-13T12:00:00Z')), [0,1,2,3,4,5,6])
  assert.deepEqual(rollingWeekdays('Asia/Singapore', new Date('2026-09-13T17:00:00Z')), [1,2,3,4,5,6,0])
})
test('today-inclusive periods contain the past six days, with an adjacent comparison period', () => {
  const now = new Date('2026-09-14T12:00:00Z')
  assert.deepEqual(reportingWindow(7,'UTC',now,false,true), {start:'2026-09-08',end:'2026-09-15'})
  assert.deepEqual(reportingWindow(7,'UTC',now,true,true), {start:'2026-09-01',end:'2026-09-08'})
  assert.deepEqual(reportingWindow(7,'America/New_York',new Date('2026-03-09T12:00:00Z'),false,true), {start:'2026-03-03',end:'2026-03-10'})
})
test('today coverage requires a sync today, not tomorrow; old cache stays incomplete', () => {
  const now = new Date('2026-09-14T12:00:00Z')
  const cache = {timezone:'UTC',syncedAt:now.toISOString(),omitted:0,total:0,records:[]} as unknown as HistoryCache
  const window = reportingWindow(7,'UTC',now,false,true)
  assert.equal(coversWindow(cache,window,now),true)
  assert.equal(coversWindow({...cache,syncedAt:'2026-09-13T23:00:00Z'},window,now),false)
  assert.equal(coversWindow(cache,window),false)
})
test('latest shot display removes category but retains the profile name', () => {
  assert.equal(parseProfileTitle('A-Flow / Adaptive V2').name,'Adaptive V2')
  assert.equal(parseProfileTitle('Adaptive V2').name,'Adaptive V2')
})
