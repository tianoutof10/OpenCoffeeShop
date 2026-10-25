import type { ShotStateEvent } from '../../api/decaid/types.ts'
import type { StageAdvanceEvidence } from './stageMoveOn.ts'

export function weightAdvanceEvidence(event: ShotStateEvent): StageAdvanceEvidence | undefined {
  const decision = event.decision, frame = decision?.data?.frame
  const timestamp = Date.parse(event.timestamp ?? '')
  if (event.event !== 'decision' || decision?.kind !== 'advance' || decision.reason !== 'profileSkip'
    || !Number.isInteger(frame) || Number(frame) < 0 || !Number.isFinite(timestamp)
    || typeof decision.data?.stepExitWeight !== 'number' || decision.data.stepExitWeight <= 0) return undefined
  return { frame: Number(frame), timestamp, reason: 'weight' }
}
export function recordedStopReason(event: ShotStateEvent): string | undefined {
  return ['decision', 'terminal'].includes(event.event ?? '') && ['stop', 'abort', 'terminal'].includes(event.decision?.kind ?? '')
    ? event.decision?.reason : undefined
}
