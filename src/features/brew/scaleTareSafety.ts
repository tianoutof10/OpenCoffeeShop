interface TareSnapshot {
  state?: string | { state?: string; substate?: string }
}

export interface ScaleTareState {
  blockDuringShot?: boolean
  shotActive: boolean
  machineKnown: boolean
  scaleConnected: boolean
  preparing: boolean
}

export function observeTareShotState(previous: boolean, snapshot: TareSnapshot): boolean {
  const state = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
  if (!state) return previous
  return state === 'espresso' || state === 'skipstep'
}

export function scaleTareBlocked(state: Pick<ScaleTareState, 'blockDuringShot' | 'shotActive' | 'machineKnown'>): boolean {
  return state.blockDuringShot !== false && (state.shotActive || !state.machineKnown)
}

export async function requestGuardedScaleTare({ readState, refreshSettings, sendTare, automatic = false }: {
  readState: () => ScaleTareState
  refreshSettings: () => Promise<void>
  sendTare: () => Promise<void>
  automatic?: boolean
}): Promise<'tared' | 'blocked' | 'disconnected' | 'cancelled'> {
  const before = readState()
  if (!before.scaleConnected) return 'disconnected'
  if (before.blockDuringShot === true && scaleTareBlocked(before)) return 'blocked'
  await refreshSettings()
  const current = readState()
  if (!current.scaleConnected) return 'disconnected'
  if (scaleTareBlocked(current)) return 'blocked'
  // A preparation request must never arrive late and zero coffee already poured.
  if (automatic && !current.preparing) return 'cancelled'
  await sendTare()
  return 'tared'
}
