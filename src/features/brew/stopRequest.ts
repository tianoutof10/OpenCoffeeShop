export const STOP_CONFIRM_TIMEOUT_MS = 2_500
export const STOP_REQUEST_ATTEMPTS = 2

export type StopObservation = 'pending' | 'confirmed' | 'disconnected' | 'superseded'
export type StopRequestResult = Exclude<StopObservation, 'pending'> | 'unconfirmed' | 'failed'

interface StopSnapshot { timestamp?: string; state?: string | { state?: string } }
const stoppedStates = new Set(['idle', 'sleeping', 'hotwater', 'steam', 'flush', 'descaling', 'airpurge', 'transportmode', 'needswater', 'error'])

/** Session disappearance is not evidence: disconnects also clear live sessions.
 * Only a newer, explicit non-shot machine snapshot can confirm a stop. */
export function createStopObservation<Session>(session: Session, lastTimestamp: string | undefined) {
  const baseline = Date.parse(lastTimestamp ?? '')
  let status: StopObservation = 'pending'
  return {
    status(currentSession: Session | null): StopObservation {
      return status === 'pending' && currentSession !== session ? 'superseded' : status
    },
    observe(snapshot: StopSnapshot, currentSession: Session | null) {
      if (status !== 'pending') return
      if (currentSession !== session) { status = 'superseded'; return }
      const timestamp = Date.parse(snapshot.timestamp ?? '')
      const state = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
      if (Number.isFinite(baseline) && timestamp > baseline && state && stoppedStates.has(state)) status = 'confirmed'
    },
    disconnect() { if (status === 'pending') status = 'disconnected' },
  }
}

interface StopRequestApi {
  sendIdle: () => Promise<void>
  observation: () => StopObservation
  wait: (ms: number) => Promise<void>
  attempts?: number
  confirmTimeoutMs?: number
}

/**
 * An accepted `idle` request is not proof the machine stopped (lost BLE command,
 * busy queue). Resend once when telemetry does not confirm the stop, then hand
 * the button back to the user instead of leaving it pending forever.
 */
export async function requestMachineStop({ sendIdle, observation, wait, attempts = STOP_REQUEST_ATTEMPTS, confirmTimeoutMs = STOP_CONFIRM_TIMEOUT_MS }: StopRequestApi): Promise<StopRequestResult> {
  let lastAttemptFailed = false
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const before = observation()
    if (before !== 'pending') return before
    try {
      await sendIdle()
      lastAttemptFailed = false
    } catch {
      lastAttemptFailed = true
    }
    const after = observation()
    if (after !== 'pending') return after
    await wait(confirmTimeoutMs)
    const confirmed = observation()
    if (confirmed !== 'pending') return confirmed
  }
  return lastAttemptFailed ? 'failed' : 'unconfirmed'
}
