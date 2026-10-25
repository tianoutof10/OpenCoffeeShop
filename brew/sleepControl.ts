import type { MachineReadiness } from '../../domain/brewing'

export const SLEEP_DISPLAY_BRIGHTNESS = 7

interface SleepControlApi {
  setMachineState: (state: 'sleeping') => Promise<void>
}

export async function sleepMachineWithConfiguredScalePolicy(api: SleepControlApi) {
  await api.setMachineState('sleeping')
}

export const BACKGROUND_SCALE_SCAN_BASE_DELAY_MS = 5_000
export const BACKGROUND_SCALE_SCAN_MAX_DELAY_MS = 5 * 60_000

// A BLE scan competes with the DE1 connection on weak tablets: never scan while
// the machine is pouring, and back off while the preferred scale stays away.
export const shouldRunBackgroundScaleScan = (
  preferredScaleId: string | null | undefined,
  scaleConnected: boolean,
  readiness: MachineReadiness | null,
  machineBusy = false,
) => Boolean(preferredScaleId) && !scaleConnected && readiness !== 'sleeping' && !machineBusy

/** 5 s, 10 s, 20 s ... capped at 5 min after consecutive scans without a scale. */
export const backgroundScaleScanDelayMs = (unsuccessfulScans: number) => Math.min(
  BACKGROUND_SCALE_SCAN_MAX_DELAY_MS,
  BACKGROUND_SCALE_SCAN_BASE_DELAY_MS * 2 ** Math.min(16, Math.max(0, Math.floor(unsuccessfulScans))),
)
