import test from 'node:test'
import assert from 'node:assert/strict'
import { steamBelowReadyRange, STEAM_READY_TOLERANCE_C } from '../src/features/machine/steamGauge.ts'
import { gaugeLayout, gaugeFraction, gaugeGeometry, gaugeArcPath, gaugePointAtAngle, GAUGE_START_DEG, GAUGE_SWEEP_DEG, GAUGE_CENTER, GAUGE_RADIUS, GAUGE_TRACK_PATH, GAUGE_MIN_C } from '../src/features/machine/steamGauge.ts'

test('arc starts at 40°C for cold warm-up, independently of the target minimum', () => {
  assert.equal(GAUGE_MIN_C, 40)
  assert.equal(gaugeFraction(40, GAUGE_MIN_C, 170), 0)
  assert.equal(gaugeFraction(45, GAUGE_MIN_C, 170), 5 / 130)
  assert.equal(gaugeFraction(50, GAUGE_MIN_C, 170), 10 / 130)
  assert.equal(gaugeFraction(105, GAUGE_MIN_C, 170), .5)
  assert.equal(gaugeFraction(135, GAUGE_MIN_C, 170), 95 / 130)
  assert.equal(gaugeFraction(170, GAUGE_MIN_C, 170), 1)
  assert.equal(gaugeGeometry(164, GAUGE_MIN_C, 170).fraction, 124 / 130)
})
test('cold and overheated readings clamp visually without changing their numbers', () => {
  assert.equal(gaugeFraction(20, GAUGE_MIN_C, 170), 0)
  assert.equal(gaugeFraction(180, GAUGE_MIN_C, 170), 1)
})

test('steam stays green at up to three Celsius degrees below target', () => {
  assert.equal(STEAM_READY_TOLERANCE_C, 3)
  for (const target of [135, 160, 165, 170]) {
    for (const offset of [0, 1, 2, 3, -1]) {
      assert.equal(steamBelowReadyRange(target - offset, target, true), false)
    }
    assert.equal(steamBelowReadyRange(target - 3.01, target, true), true)
    assert.equal(steamBelowReadyRange(target - 4, target, true), true)
  }
})

test('steam tolerance preserves off and unavailable-reading handling', () => {
  assert.equal(steamBelowReadyRange(40, 165, false), false)
  assert.equal(steamBelowReadyRange(NaN, 165, true), false)
  assert.equal(steamBelowReadyRange(150, NaN, true), true)
})

test('only a roomy temperature area opens the arc to two-thirds of a circle', () => {
  assert.deepEqual(gaugeLayout(300, 189), { tall: false, sweep: 144, viewHeight: 80 })
  assert.equal(gaugeLayout(209, 300).tall, false)
  assert.deepEqual(gaugeLayout(300, 190), { tall: true, sweep: 240, viewHeight: 158 })
  for (const sweep of [144, 240]) {
    const start = gaugeGeometry(40, 40, 170, sweep)
    const end = gaugeGeometry(170, 40, 170, sweep)
    assert.equal(end.angle - start.angle, sweep)
    assert.ok(Math.abs(start.top - end.top) < 1e-9)
    for (const value of [40, 105, 135, 164, 170]) {
      const point = gaugeGeometry(value, 40, 170, sweep)
      assert.ok(gaugeArcPath(point.fraction, sweep).endsWith(`${point.left} ${point.top}`) || point.fraction === 0)
      const dx = point.markerEnd.left - point.markerStart.left
      const dy = point.markerEnd.top - point.markerStart.top
      assert.ok(Math.abs((point.left - GAUGE_CENTER) * dy - (point.top - GAUGE_CENTER) * dx) < 1e-9)
    }
  }
  assert.match(gaugeArcPath(1, 240), / A 94 94 0 1 1 /)
})
test('temperature and target use identical positions when equal', () => {
  for (const value of [135, 150, 164, 170]) {
    const current = gaugeGeometry(value, GAUGE_MIN_C, 170)
    const target = gaugeGeometry(value, GAUGE_MIN_C, 170)
    assert.deepEqual(current, target)
    assert.ok(Math.abs(Math.hypot(target.left - 98.5, target.top - 98.5) - 94) < 1e-9)
  }
})
test('target line is radial at every point on the arc', () => {
  for (const value of [135, 145, 152.5, 164, 170]) {
    const target = gaugeGeometry(value, GAUGE_MIN_C, 170)
    const dx = target.markerEnd.left - target.markerStart.left
    const dy = target.markerEnd.top - target.markerStart.top
    const crossProduct = (target.left - GAUGE_CENTER) * dy - (target.top - GAUGE_CENTER) * dx
    assert.ok(Math.abs(crossProduct) < 1e-9)
    assert.ok(Math.abs(Math.hypot(dx, dy) - 15) < 1e-9)
    assert.ok(Math.abs((target.markerStart.left + target.markerEnd.left) / 2 - target.left) < 1e-9)
    assert.ok(Math.abs((target.markerStart.top + target.markerEnd.top) / 2 - target.top) < 1e-9)
  }
})
test('arc is a true two-fifths circle with level endpoints and its midpoint at the top', () => {
  const start = gaugePointAtAngle(GAUGE_START_DEG)
  const end = gaugePointAtAngle(GAUGE_START_DEG + GAUGE_SWEEP_DEG)
  const midpoint = gaugePointAtAngle(GAUGE_START_DEG + GAUGE_SWEEP_DEG / 2)
  assert.equal(GAUGE_SWEEP_DEG, 144)
  const halfSweep = 72 * Math.PI / 180
  assert.ok(Math.abs(start.top - (GAUGE_CENTER - GAUGE_RADIUS * Math.cos(halfSweep))) < 1e-9)
  assert.ok(Math.abs(start.left - (GAUGE_CENTER - GAUGE_RADIUS * Math.sin(halfSweep))) < 1e-9)
  // A wider chord for the same rise, without turning the circle into an ellipse.
  assert.ok((end.left - start.left) / (start.top - midpoint.top) > 2.7)
  assert.ok(Math.abs(start.top - end.top) < 1e-9)
  assert.ok(Math.abs(start.left + end.left - 2 * GAUGE_CENTER) < 1e-9)
  assert.ok(Math.abs(midpoint.left - GAUGE_CENTER) < 1e-9)
  assert.equal(midpoint.top, GAUGE_CENTER - GAUGE_RADIUS)
  for (let fraction = 0; fraction <= 1; fraction += .05) {
    const point = gaugePointAtAngle(GAUGE_START_DEG + fraction * GAUGE_SWEEP_DEG)
    assert.ok(point.top <= GAUGE_CENTER + 1e-9)
    assert.ok(Math.abs(Math.hypot(point.left - GAUGE_CENTER, point.top - GAUGE_CENTER) - GAUGE_RADIUS) < 1e-9)
  }
})
test('track and progress use the same circular path with no fill below range', () => {
  assert.equal(gaugeArcPath(0), '')
  assert.equal(gaugeArcPath(-1), '')
  assert.equal(gaugeArcPath(NaN), '')
  assert.equal(gaugeArcPath(1), GAUGE_TRACK_PATH)
  assert.equal(gaugeArcPath(2), GAUGE_TRACK_PATH)
  assert.match(gaugeArcPath(.5), / A 94 94 0 0 1 /)
  assert.match(GAUGE_TRACK_PATH, / A 94 94 0 0 1 /)
  for (const value of [45, 50, 105, 140, 150, 164, 170]) {
    const tip = gaugeGeometry(value, GAUGE_MIN_C, 170)
    assert.ok(gaugeArcPath(tip.fraction).endsWith(`${tip.left} ${tip.top}`))
  }
})
