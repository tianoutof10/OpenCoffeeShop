import assert from 'node:assert/strict'
import test from 'node:test'
import { analyseStageMoveOn, stageReasonKey } from '../src/features/brew/stageMoveOn.ts'
import type { LiveShotPoint } from '../src/domain/brewing.ts'
import type { DecaidProfileStep } from '../src/api/decaid/types.ts'

const samples = (values: number[], axis = 'pressure'): LiveShotPoint[] => values.map((value, i) => ({ elapsedMs: i * 500, stageIndex: i === values.length - 1 ? 1 : 0, [axis]: value }))
const result = (points: LiveShotPoint[], step: DecaidProfileStep, options = {}) => analyseStageMoveOn(points, [step], options).reasons[stageReasonKey(points[0])]

for (const type of ['pressure', 'flow'] as const) for (const condition of ['over', 'under'] as const) {
  test(`${type} ${condition}: recognizes a near, trending crossing on the first new-frame sample`, () => {
    const values = condition === 'over' ? [3.6, 3.8, 3.95, 4.1] : [4.4, 4.2, 4.05, 3.9]
    assert.equal(result(samples(values, type), { exit: { type, condition, value: 4 } }).label, `${type === 'pressure' ? 'Pressure' : 'Flow'} ${condition === 'over' ? '>' : '<'}4 ${type === 'pressure' ? 'bar' : 'ml/s'} reached`)
    assert.equal(result(samples([2, 2, 2, 6], type), { exit: { type, condition: 'over', value: 4 } }).label, 'Unknown')
    assert.equal(result(samples([6, 6, 6, 2], type), { exit: { type, condition: 'under', value: 4 } }).label, 'Unknown')
  })
}
test('local boundary gaps remain unknown; old gaps do not invalidate duration or sensor evidence', () => {
  const p = samples([2, 3, 4, 4])
  p[3].elapsedMs = 5000
  assert.equal(result(p, { exit: { type: 'pressure', condition: 'over', value: 4 } }).label, 'Unknown')
  const oldGap = [{elapsedMs:0,stageIndex:0}, {elapsedMs:9500,stageIndex:0}, {elapsedMs:10000,stageIndex:1}]
  assert.equal(result(oldGap, { seconds:10 }).label, 'Time limit reached')
  assert.equal(result(oldGap.map(p=>({...p,flow:2})), {volume:20}).label, 'Unknown')
})
test('compares duration and sensor exits with the encoded firmware values', () => {
  const p = [{elapsedMs:0,stageIndex:0}, {elapsedMs:12500,stageIndex:0}, {elapsedMs:13000,stageIndex:0}, {elapsedMs:13500,stageIndex:1}]
  assert.equal(result(p, {seconds:12.8}).label, 'Time limit reached')
  assert.equal(result(samples([3,3.9,4.0625,4.1]), {exit:{type:'pressure',condition:'over',value:4.08}}).label, 'Pressure >4.08 bar reached')
})
test('natural final-frame completion uses profile exits without overriding explicit stops', () => {
  const p = samples([2,3,4,4]).map(p=>({...p,stageIndex:0}))
  const step = {seconds:1.5,exit:{type:'pressure',condition:'over',value:4}}
  assert.equal(result(p,step,{stopReason:'machineEnded'}).label,'Time limit reached or Pressure >4 bar reached')
  assert.equal(result(p,step,{stopReason:'apiStop'}).label,'Manually stopped')
  assert.equal(result(p,step,{stopReason:'disconnected'}).label,'Connection lost')
  assert.equal(result(p,step,{stopReason:'unrecognized'}).label,'Unknown')
  assert.equal(analyseStageMoveOn(p,[step,step]).reasons[stageReasonKey(p[0])].label,'Unknown')
  assert.equal(analyseStageMoveOn(p,[step],{active:true}).reasons[stageReasonKey(p[0])],undefined)
})
test('numeric strings, recorded priority, and OR remain supported', () => {
  const step = JSON.parse('{"seconds":"1.5","exit":{"type":"pressure","condition":"over","value":"4"}}')
  const p = samples([3.6,3.8,3.95,4.1])
  assert.equal(result(p,step).label,'Time limit reached or Pressure >4 bar reached')
  assert.equal(result(p,step,{telemetryStartedAt:10000,evidence:[{frame:0,timestamp:11000,reason:'manual'}]}).label,'Manually advanced')
})
test('frame jumps do not manufacture exits for unobserved frames or use their sensor values', () => {
  const p = samples([3.6,3.8,3.95,4.1]).map(p=>p.stageIndex===1?{...p,stageIndex:3}:p)
  const r = analyseStageMoveOn(p,[{exit:{type:'pressure',condition:'over',value:4}},{},{},{}])
  assert.equal(r.reasons[stageReasonKey(p[0])].label,'Unknown')
  assert.equal(Object.keys(r.reasons).length,2)
})
