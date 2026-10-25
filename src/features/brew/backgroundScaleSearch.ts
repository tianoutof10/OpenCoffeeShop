import { backgroundScaleScanDelayMs, shouldRunBackgroundScaleScan } from './sleepControl.ts'
import type { MachineReadiness } from '../../domain/brewing.ts'

export interface ScaleSearchState {
  preferredScaleId: string | null
  scaleConnected: boolean
  machineConnected: boolean
  readiness: MachineReadiness | null
  machineBusy: boolean
}

/** A single cancellable timer; manual Search deliberately bypasses this queue.
 * refresh() is cheap enough for telemetry, but only state transitions reset backoff.
 * An already-started device scan cannot be cancelled by this API. */
export function createBackgroundScaleSearch(api: {
  state(): ScaleSearchState
  scan(): Promise<unknown>
  schedule(callback: () => void, delay: number): number
  cancel(timer: number): void
}) {
  let timer: number | null = null
  let scanning = false
  let disposed = false
  let failures = 0
  let generation = 0
  let previous: ScaleSearchState | undefined
  const eligible = (s: ScaleSearchState) => s.machineConnected && s.readiness !== null && s.readiness !== 'disconnected' && shouldRunBackgroundScaleScan(s.preferredScaleId, s.scaleConnected, s.readiness, s.machineBusy)
  const clear = () => { if (timer !== null) api.cancel(timer); timer = null }
  const schedule = () => {
    if (disposed || scanning || timer !== null || !eligible(api.state())) return
    timer = api.schedule(() => { void run() }, backgroundScaleScanDelayMs(failures))
  }
  const run = async () => {
    timer = null
    if (disposed || !eligible(api.state())) return
    scanning = true
    const startedGeneration = generation
    try { await api.scan() } catch { /* Bounded retry while disconnected. */ }
    finally {
      scanning = false
      if (!disposed) {
        if (api.state().scaleConnected) failures = 0
        else if (generation === startedGeneration) failures++
        refresh()
      }
    }
  }
  const refresh = () => {
    if (disposed) return
    const next = api.state()
    const changed = !previous || next.preferredScaleId !== previous.preferredScaleId
      || next.machineConnected !== previous.machineConnected
      || next.scaleConnected !== previous.scaleConnected
      || (next.readiness === 'sleeping') !== (previous.readiness === 'sleeping')
      || next.machineBusy !== previous.machineBusy
    previous = { ...next }
    if (changed) { failures = 0; generation++; clear() }
    if (!eligible(next)) clear()
    else schedule()
  }
  return {
    refresh,
    reset() { if (disposed) return; failures = 0; generation++; clear(); refresh() },
    dispose() { disposed = true; generation++; clear() },
  }
}
