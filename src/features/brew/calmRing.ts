/** Without a yield target the calm ring tracks time, completing one turn per 30 s. */
export const CALM_TIME_RING_MS = 30_000

export function calmRingProgress(weight: number | undefined, targetYield: number | undefined, elapsedMs: number) {
  if (targetYield !== undefined && targetYield > 0) return Math.max(0, Math.min(1, (weight ?? 0) / targetYield))
  return Math.max(0, Math.min(1, elapsedMs / CALM_TIME_RING_MS))
}
