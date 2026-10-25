import { DecaidApiError, getSharedSetting, setSharedSetting, updateWorkflow } from '../../api/decaid/client'
import { createHotWaterSync } from './hotWaterSync'

// One writer for the home adjusters and Settings.
export const hotWaterSettings = createHotWaterSync({
  read: (key) => getSharedSetting(key).catch((error) => {
    if (error instanceof DecaidApiError && error.status === 404) return null
    throw error
  }),
  store: setSharedSetting,
  update: updateWorkflow,
})
