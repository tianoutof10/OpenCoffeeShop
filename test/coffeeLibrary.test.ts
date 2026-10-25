import assert from 'node:assert/strict'
import test from 'node:test'
import { activeBean, coffeeUpdates, grindReferenceFor, normalizeLibrary } from '../src/features/beans/coffeeLibrary.ts'

const empty = normalizeLibrary(undefined)
const now = new Date('2026-10-24T08:00:00Z')

test('adding a bean loads it; archiving unloads it and restoring keeps its history', () => {
  const { library, bean } = coffeeUpdates.addBean(empty, { name: 'Guji', roaster: 'Example', tastingNotes: ['peach'] }, now)
  assert.equal(activeBean(library)?.id, bean.id)
  const archived = coffeeUpdates.archiveBean(library, bean.id, true, now)
  assert.equal(activeBean(archived), undefined)
  assert.ok(archived.beans[0].archivedAt)
  const restored = coffeeUpdates.loadBean(archived, bean.id, now)
  assert.equal(activeBean(restored)?.id, bean.id)
  assert.equal(restored.beans[0].archivedAt, undefined)
})

test('grind references follow the bean × profile pairing before the profile setting', () => {
  const { library, bean } = coffeeUpdates.addBean(empty, { name: 'Guji', tastingNotes: [] }, now)
  assert.equal(grindReferenceFor(library, bean.id, 'p1', '14'), '14')
  const remembered = coffeeUpdates.rememberGrind(library, bean.id, 'p1', '11.5', now)
  assert.equal(grindReferenceFor(remembered, bean.id, 'p1', '14'), '11.5')
  assert.equal(grindReferenceFor(remembered, bean.id, 'p2', '14'), '14')
  assert.equal(grindReferenceFor(remembered, undefined, 'p1', '—'), undefined)
})

test('linking a shot records the bean and refreshes its last-used time', () => {
  const { library, bean } = coffeeUpdates.addBean(empty, { name: 'Guji', tastingNotes: [] }, now)
  const later = new Date('2026-10-25T08:00:00Z')
  const linked = coffeeUpdates.linkShot(library, 'shot-1', { beanId: bean.id, profileId: 'p1', grindSetting: '12' }, later)
  assert.deepEqual(linked.shotBeans['shot-1'], { beanId: bean.id, profileId: 'p1', grindSetting: '12' })
  assert.equal(linked.beans[0].lastUsedAt, later.toISOString())
})

test('stored libraries are validated: unnamed beans, bad dates and unknown loaded IDs are dropped', () => {
  const library = normalizeLibrary({ beans: [{ id: 'a', name: '' }, { id: 'b', name: 'Kenya', roastDate: 'yesterday', roastLevel: 'burnt' }], activeBeanId: 'zzz', gear: { style: 'body' } })
  assert.equal(library.beans.length, 1)
  assert.equal(library.beans[0].roastDate, undefined)
  assert.equal(library.beans[0].roastLevel, undefined)
  assert.equal(library.activeBeanId, undefined)
  assert.equal(library.gear.style, 'body')
})
