import type { DecaidProfileRecord, DecaidWorkflow, FavoriteAssignments } from '../../api/decaid/types.ts'
import { t } from '../../i18n/index.ts'

export const canDeleteProfile = (record: DecaidProfileRecord | undefined) => Boolean(record?.id && record.isDefault === false && record.visibility !== 'deleted' && record.visibility !== 'hidden')

export function assertProfileDeletionAllowed(record: DecaidProfileRecord | undefined, activeId?: string, busy = false) {
  if (!canDeleteProfile(record)) throw new Error(t('library.deletion.onlyUserProfiles'))
  if (busy) throw new Error(t('library.deletion.machineBusy'))
  if (record?.id === activeId) throw new Error(t('library.delete.currentlyLoaded'))
}

export const favoritesWithoutProfile = (assignments: FavoriteAssignments, id: string): FavoriteAssignments =>
  Object.fromEntries(Object.entries(assignments).map(([slot, profileId]) => [slot, profileId === id ? null : profileId]))

interface DeletionApi {
  read: (id: string) => Promise<DecaidProfileRecord>
  workflow: () => Promise<DecaidWorkflow>
  remove: (id: string) => Promise<void>
  activeId: () => string | undefined
  busy: () => boolean
}

// Use Decaid's recoverable DELETE, never /purge. Re-read protection and the
// loaded workflow immediately before the write; stale UI is not authority.
export async function deleteVerifiedUserProfile(id: string, api: DeletionApi) {
  const [record, workflow] = await Promise.all([api.read(id), api.workflow()])
  if (record.id !== id) throw new Error(t('library.deletion.differentProfile'))
  // A retry after a lost response can complete local cleanup without deleting twice.
  if (record.isDefault === false && record.visibility === 'deleted') return
  assertProfileDeletionAllowed(record, api.activeId(), api.busy())
  if (record.profile?.title && record.profile.title === workflow.profile?.title) {
    throw new Error(t('library.deletion.currentlyLoadedInDecaid'))
  }
  let writeError: unknown
  try { await api.remove(id) } catch (error) { writeError = error }
  const saved = await api.read(id).catch(() => null)
  if (saved?.id === id && saved.isDefault === false && saved.visibility === 'deleted') return
  if (writeError && saved?.visibility === 'visible') throw writeError
  throw new Error(t('library.deletion.verifyFailed'))
}
