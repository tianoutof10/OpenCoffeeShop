import type { LiveShotPoint } from '../../domain/brewing.ts'

/** Retain the complete current shot, including early stage boundaries. This is
 * session-owned storage, not a rolling telemetry window; each shot starts fresh. */
export function appendLiveShotSample(points: LiveShotPoint[], point: LiveShotPoint): boolean {
  if (!Number.isFinite(point.elapsedMs) || point.elapsedMs < 0) return false
  const last = points.at(-1)
  if (last && point.elapsedMs <= last.elapsedMs) return false
  points.push(point)
  return true
}

interface SnapshotWithState {
  state?: string | { state?: string; substate?: string }
  profileFrame?: number
}

const ESPRESSO_EXTRACTION_SUBSTATES = new Set(['preinfusion', 'pouring'])
const DEFINITIVE_NON_ESPRESSO_STATES = new Set(['sleeping', 'hotwater', 'flush', 'steam', 'cleaning', 'descaling', 'transportmode', 'needswater', 'error'])
export const SKIP_TRANSITION_TIMEOUT_MS = 2_000

export interface SkipTransition {
  requestedAt: number
  fromFrame?: number
  sawSkipState: boolean
}

export interface SkipTransitionObservation {
  transition: SkipTransition | null
  keepShotActive: boolean
  acceptTelemetry: boolean
}

export interface ShotTimeline {
  telemetryStartedAt?: number
  elapsedMs: number
}

const snapshotState = (snapshot: SnapshotWithState) => (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()

export function isEspressoExtractionSnapshot(snapshot: SnapshotWithState, shotInProgress = false) {
  const state = snapshotState(snapshot)
  const substate = (typeof snapshot.state === 'object' ? snapshot.state?.substate : undefined)?.toLowerCase()
  if (state === 'skipstep') return shotInProgress
  if (state && state !== 'espresso') return false
  if (substate) return ESPRESSO_EXTRACTION_SUBSTATES.has(substate)
  return state === 'espresso'
}

/** A live session can also start mid-shot (socket reconnect, WebView reload or
 * resume). Only tare while the machine is still preparing the shot: once water
 * flows the cup may already hold coffee, and zeroing it would push Decaid's
 * stop-at-weight past the target. Decaid's own arm-before-pour tare still runs. */
export function shouldAutoTareAtShotStart(snapshot: SnapshotWithState) {
  const substate = (typeof snapshot.state === 'object' ? snapshot.state?.substate : undefined)?.toLowerCase()
  return snapshotState(snapshot) === 'espresso' && substate === 'preparingforshot'
}

export function isEspressoMonitoringSnapshot(snapshot: SnapshotWithState, keepShotActive = false) {
  return snapshotState(snapshot) === 'espresso' || keepShotActive
}

export function advanceShotTimeline(now: number, acceptsTelemetry: boolean, telemetryStartedAt?: number, lastSampleElapsedMs = 0): ShotTimeline {
  const startedAt = telemetryStartedAt ?? (acceptsTelemetry ? now : undefined)
  return {
    telemetryStartedAt: startedAt,
    // Keep the lifecycle/start clock intact for skip transitions, but do not
    // count post-extraction cleanup as brew time in the header or final stage.
    elapsedMs: startedAt === undefined ? 0 : acceptsTelemetry ? Math.max(0, now - startedAt) : lastSampleElapsedMs,
  }
}

export function beginSkipTransition(fromFrame: number | undefined, requestedAt: number): SkipTransition {
  return {
    requestedAt,
    fromFrame: typeof fromFrame === 'number' && Number.isFinite(fromFrame) ? fromFrame : undefined,
    sawSkipState: false,
  }
}

export function observeSkipTransition(snapshot: SnapshotWithState, transition: SkipTransition | null, now: number, shotInProgress: boolean): SkipTransitionObservation {
  const extracting = isEspressoExtractionSnapshot(snapshot, shotInProgress)
  if (!transition || !shotInProgress) return { transition: null, keepShotActive: extracting, acceptTelemetry: extracting }

  const state = snapshotState(snapshot)
  const withinTransitionWindow = now - transition.requestedAt <= SKIP_TRANSITION_TIMEOUT_MS
  if (!withinTransitionWindow || (state && DEFINITIVE_NON_ESPRESSO_STATES.has(state))) {
    return { transition: null, keepShotActive: extracting, acceptTelemetry: extracting }
  }

  if (state === 'skipstep') {
    return { transition: { ...transition, sawSkipState: true }, keepShotActive: true, acceptTelemetry: true }
  }

  const frame = typeof snapshot.profileFrame === 'number' && Number.isFinite(snapshot.profileFrame) ? snapshot.profileFrame : undefined
  const advancedFrame = transition.fromFrame !== undefined && frame !== undefined && frame !== transition.fromFrame
  const resumedWithoutFrames = transition.fromFrame === undefined && transition.sawSkipState && extracting
  if (extracting && (advancedFrame || resumedWithoutFrames)) {
    return { transition: null, keepShotActive: true, acceptTelemetry: true }
  }

  if (extracting) return { transition, keepShotActive: true, acceptTelemetry: true }

  // DE1 firmware can briefly report idle/pouringDone while skipToNext is
  // moving between frames. Preserve the shot but do not graph that frame.
  return { transition, keepShotActive: true, acceptTelemetry: false }
}
