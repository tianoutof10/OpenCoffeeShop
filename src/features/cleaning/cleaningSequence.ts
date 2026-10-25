import { t } from '../../i18n/index.ts'
import type { DecaidProfile, DecaidWorkflow, DecaidWorkflowPatch } from '../../api/decaid/types'

export const cleaningPreparationStatus = (selectedId: string | null, pending: boolean, preparedId: string | null, failedId: string | null) => {
  if (pending) return 'loading'
  if (selectedId && selectedId === preparedId) return 'ready'
  if (selectedId && selectedId === failedId) return 'error'
  return 'idle'
}

export const profileForCleaningShortcut = (profile: DecaidProfile): DecaidProfile => (
  profile.beverage_type?.trim().toLowerCase() === 'cleaning'
    ? profile
    : { ...profile, beverage_type: 'cleaning' }
)

interface CleaningProfilePreparationOperations {
  selectWorkflow: (profile: DecaidProfile) => Promise<DecaidWorkflow>
  uploadProfile: (profile: DecaidProfile) => Promise<void>
}

export const prepareCleaningProfileForEspressoStart = async (
  profile: DecaidProfile,
  operations: CleaningProfilePreparationOperations,
) => {
  const workflow = await operations.selectWorkflow(profile)
  const selectedProfile = workflow.profile
  if (
    selectedProfile?.title !== profile.title
    || selectedProfile?.beverage_type?.trim().toLowerCase() !== 'cleaning'
  ) {
    throw new Error(t('common.error.cleaningProfile'))
  }
  await operations.uploadProfile(selectedProfile)
  return workflow
}

export const isCleaningSequenceRun = (machineState: string | undefined, espressoMonitoring: boolean, hasPreparedCleaningProfile: boolean) => (
  machineState === 'cleaning' || (hasPreparedCleaningProfile && (machineState === 'espresso' || espressoMonitoring))
)

export const cleaningRestorePatch = (workflow: DecaidWorkflow): DecaidWorkflowPatch => ({
  profile: workflow.profile,
  context: workflow.context,
})
