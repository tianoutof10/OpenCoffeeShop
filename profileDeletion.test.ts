import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { assertProfileDeletionAllowed, canDeleteProfile, deleteVerifiedUserProfile, favoritesWithoutProfile } from '../src/features/profiles/profileDeletion.ts'
import type { DecaidProfileRecord } from '../src/api/decaid/types.ts'
import { en } from '../src/i18n/en/index.ts'

const user = (): DecaidProfileRecord => ({ id: 'user/imported', isDefault: false, visibility: 'visible', profile: { title: 'Tea concentrate' } })
function fixture() {
  let record = user()
  let writes = 0
  return {
    api: { read: async () => record, workflow: async () => ({ profile: { title: 'Another recipe' } }), activeId: () => 'other', busy: () => false,
      remove: async (id: string) => { assert.equal(id, record.id); writes++; record = { ...record, visibility: 'deleted' } } },
    writes: () => writes,
    set: (value: DecaidProfileRecord) => { record = value },
  }
}

test('deletion is limited to known user records, protecting built-in and unknown provenance', () => {
  assert.equal(canDeleteProfile(user()), true)
  for (const record of [undefined, { ...user(), isDefault: true }, { ...user(), isDefault: undefined }, { ...user(), id: undefined }, { ...user(), visibility: 'hidden' }, { ...user(), visibility: 'deleted' }]) {
    assert.equal(canDeleteProfile(record), false)
    assert.throws(() => assertProfileDeletionAllowed(record), /protected/)
  }
  assert.throws(() => assertProfileDeletionAllowed(user(), user().id), /Use another profile/)
  assert.throws(() => assertProfileDeletionAllowed(user(), 'other', true), /operation/)
})

test('soft deletion verifies the saved visibility and retries without a second deletion', async () => {
  const f = fixture()
  await deleteVerifiedUserProfile(user().id!, f.api)
  assert.equal(f.writes(), 1)
  assert.equal((await f.api.read()).visibility, 'deleted')
  await deleteVerifiedUserProfile(user().id!, f.api)
  assert.equal(f.writes(), 1)
})

test('fresh record and workflow checks prevent stale UI deleting protected or loaded profiles', async () => {
  for (const change of ['default', 'id', 'workflow', 'active', 'busy']) {
    const f = fixture()
    if (change === 'default') f.set({ ...user(), isDefault: true })
    if (change === 'id') f.set({ ...user(), id: 'someone-else' })
    if (change === 'workflow') f.api.workflow = async () => ({ profile: { title: user().profile!.title! } })
    if (change === 'active') f.api.activeId = () => user().id!
    if (change === 'busy') f.api.busy = () => true
    await assert.rejects(deleteVerifiedUserProfile(user().id!, f.api))
    assert.equal(f.writes(), 0)
  }
})

test('failed preflight reads never issue DELETE', async () => {
  const f = fixture()
  f.api.workflow = async () => { throw new Error('offline') }
  await assert.rejects(deleteVerifiedUserProfile(user().id!, f.api), /offline/)
  assert.equal(f.writes(), 0)
})

test('a rejected delete preserves the profile and reports the server error', async () => {
  const f = fixture()
  f.api.remove = async () => { throw new Error('permission denied') }
  await assert.rejects(deleteVerifiedUserProfile(user().id!, f.api), /permission denied/)
  assert.equal((await f.api.read()).visibility, 'visible')
})

test('lost delete responses are reconciled by readback rather than false failures', async () => {
  const f = fixture()
  const remove = f.api.remove
  f.api.remove = async id => { await remove(id); throw new Error('lost response') }
  await deleteVerifiedUserProfile(user().id!, f.api)
  assert.equal(f.writes(), 1)
})

test('unverified, wrong-ID or protected readback cannot be reported as successful deletion', async () => {
  for (const value of [user(), { ...user(), visibility: 'deleted', id: 'wrong' }, { ...user(), visibility: 'deleted', isDefault: true }]) {
    const f = fixture()
    f.api.remove = async () => f.set(value)
    await assert.rejects(deleteVerifiedUserProfile(user().id!, f.api), /Could not verify/)
  }
})

test('favorite cleanup leaves slots in place and preserves unrelated assignments', () => {
  const favorites = { 0: 'builtin', 1: 'user/imported', 2: null, 3: 'recent-other', 4: 'user/imported' }
  assert.deepEqual(favoritesWithoutProfile(favorites, 'user/imported'), { 0: 'builtin', 1: null, 2: null, 3: 'recent-other', 4: null })
  assert.equal(favorites[1], 'user/imported')
})

test('detail deletion is confirmed, does not purge records, and is wired to library cleanup', () => {
  const client = readFileSync(new URL('../src/api/decaid/client.ts', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../src/features/profiles/ProfilesPanel.tsx', import.meta.url), 'utf8')
  const dialog = readFileSync(new URL('../src/features/profiles/ProfileDeleteDialog.tsx', import.meta.url), 'utf8')
  const hook = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
  assert.match(client, /function deleteProfile[\s\S]*?encodeURIComponent\(profileId\).*method: 'DELETE'/)
  assert.doesNotMatch(client, /\/purge/)
  assert.match(panel, /canDeleteProfile\?\.\(detail.id\)/)
  const actions = panel.slice(panel.indexOf('<header className="pl-detail-header">'), panel.indexOf('<section className="pl-detail-metrics"'))
  assert.match(actions, /name="cup"[\s\S]*?favorite\(detail\)[\s\S]*?onEditProfile\(detail.id\)[\s\S]*?className="pl-button pl-danger"/)
  assert.doesNotMatch(panel, /profile-detail__delete-row/)
  assert.match(dialog, /element.showModal\(\)/)
  assert.match(dialog, /if \(inFlight.current \|\| active\) return/)
  assert.match(dialog, /autoFocus disabled=\{pending\} onClick=\{onClose\}>\{t\('library\.action\.cancel'\)\}/)
  assert.equal(en['library.action.cancel'], 'Cancel')
  const deletion = hook.slice(hook.indexOf('const deleteSavedProfile'), hook.indexOf('const profileCanBeDeleted'))
  assert.match(deletion, /setAllProfiles\(remaining\)/)
  assert.match(deletion, /setFavoriteProfileSlots/)
  assert.doesNotMatch(deletion, /setMachineProfile|setMachineState|updateWorkflow|shotHistoryCache|setShotHistory/)
})

test('Sleep is leftmost in machine controls and retains the same handler and pending guard', () => {
  const shell = readFileSync(new URL('../src/app/AppShell.tsx', import.meta.url), 'utf8')
  const controls = shell.slice(shell.indexOf("<nav aria-label={t('shell.appShell.machineControls')}>"), shell.indexOf('</nav></header>'))
  assert.ok(controls.indexOf('onClick={onSleep}') < controls.indexOf("aria-label={t('shell.appShell.cleaningSequences')}"))
  assert.ok(controls.indexOf("aria-label={t('shell.appShell.cleaningSequences')}") < controls.indexOf("aria-label={t('shell.appShell.settings')}"))
  assert.match(controls, /disabled=\{sleepPending\} onClick=\{onSleep\}/)
})
