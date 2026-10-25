import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as motion from '../src/features/brew/profileCarouselMotion.ts'
const { profileCardMotion, profileCardPosition, projectedProfileSteps, wrappedProfileOffset } = motion

const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('a long swipe can traverse several profiles', () => {
  assert.equal(projectedProfileSteps(-290, 0, 120, 6), 2)
  assert.equal(projectedProfileSteps(370, 0, 120, 6), -3)
})

test('a quick flick projects beyond its raw drag distance', () => {
  assert.equal(projectedProfileSteps(-100, -0.8, 120, 6), 2)
  assert.equal(projectedProfileSteps(-55, 0, 120, 6), 1)
  assert.equal(projectedProfileSteps(-290, -20, 120, 6), 3)
})

test('profile offsets and motion remain continuous around the carousel', () => {
  assert.equal(wrappedProfileOffset(5, 0, 6), -1)
  assert.equal(wrappedProfileOffset(0, 5, 6), 1)
  assert.deepEqual(profileCardMotion(0), { xPercent: 0, scale: 1, opacity: 1, zIndex: 10 })
  assert.equal(profileCardMotion(1).scale, 0.75)
  assert.equal(profileCardMotion(2).scale, 0.59)
})

test('only five profile slots remain visible with an ad hoc sixth card', () => {
  for (const center of [0, .25, .5, .75, 1]) {
    const positions = Array.from({ length: 6 }, (_, index) => profileCardPosition(wrappedProfileOffset(index, center, 6)))
    assert.equal(positions.filter((position) => position !== 'hidden').length, 5)
  }
})

test('profile selection animates between taps while direct dragging tracks the pointer', () => {
  assert.match(styles, /\.profile-card\.profile-card--free \{[^}]*transition:opacity \.2s ease,transform \.24s cubic-bezier/)
  assert.match(styles, /\.profile-carousel--dragging \.profile-card--free \{ transition:none; \}/)
})

test('profile cards omit backdrop blur and reserve glass highlights for the active card', () => {
  assert.match(styles, /\.profile-card \{ border:1px solid rgba\(255,255,255,\.075\); background-clip:padding-box; \}/)
  assert.doesNotMatch(styles, /\.profile-card[^{}]*\{[^}]*backdrop-filter:/)
  assert.match(styles, /\.profile-card--left,\.profile-card--right \{ background:rgba\(29,35,33,\.9\); box-shadow:0 24px 42px rgba\(0,0,0,\.34\); \}/)
  assert.match(styles, /\.profile-card--far-left,\.profile-card--far-right \{ border-color:rgba\(255,255,255,\.045\); background:rgba\(29,35,33,\.64\); box-shadow:none; \}/)
  assert.match(styles, /\.profile-card--active::before \{ inset:-52%; background:radial-gradient\(circle at 22% 78%[^}]*radial-gradient\(circle at 78% 22%/)
  assert.match(styles, /\.profile-card--active::after \{[^}]*linear-gradient\(145deg,rgba\(255,255,255,\.105\)/)
  assert.match(styles, /animation:profile-card-gradient-orbit 30s linear infinite/)
  assert.match(styles, /\.profile-card--active \{[^}]*conic-gradient\(from var\(--profile-border-angle\)[^}]*animation:profile-card-border-orbit 7s cubic-bezier\(\.87,0,\.13,1\) infinite/)
  assert.match(styles, /@keyframes profile-card-border-orbit \{ 0% \{ --profile-border-angle:0deg; \} 28\.571%,100% \{ --profile-border-angle:360deg; \} \}/)
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.profile-card--active\{animation:none\}/)
})

function frameHarness() {
  assert.equal(typeof motion.createFramePublisher, 'function')
  let nextId = 0
  const callbacks = new Map<number, () => void>()
  const values: number[] = []
  const publisher = motion.createFramePublisher(
    value => values.push(value),
    callback => { const id = nextId++; callbacks.set(id, callback); return id },
    id => { callbacks.delete(id) },
  )
  const flush = () => {
    const frame = [...callbacks.values()]
    callbacks.clear()
    frame.forEach(callback => callback())
  }
  return { publisher, callbacks, values, flush }
}

test('drag rendering publishes only the latest move once per animation frame', () => {
  const h = frameHarness()
  h.publisher.schedule(0.1)
  h.publisher.schedule(0.5)
  h.publisher.schedule(-0.8)
  assert.equal(h.callbacks.size, 1)
  assert.deepEqual(h.values, [])
  h.flush()
  assert.deepEqual(h.values, [-0.8])
  h.publisher.schedule(1.2)
  h.flush()
  assert.deepEqual(h.values, [-0.8, 1.2])
})

test('ending or cancelling a gesture discards pending display updates, including frame id zero', () => {
  const h = frameHarness()
  h.publisher.schedule(0.8)
  h.publisher.cancel()
  h.publisher.cancel()
  h.flush()
  assert.deepEqual(h.values, [])
  h.publisher.schedule(-0.2)
  h.flush()
  assert.deepEqual(h.values, [-0.2])
})
