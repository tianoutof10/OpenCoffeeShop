import type { DecaidSettings } from '../../api/decaid/types'

// Connecting a scale enables weight stopping, never changes calibration.
// Decaid deliberately calibrates espresso and hot water independently.
export function hotWaterWeightStoppingPatch(settings: DecaidSettings): Partial<DecaidSettings> {
  return settings.stopHotWaterAtWeight === true ? {} : { stopHotWaterAtWeight: true }
}
