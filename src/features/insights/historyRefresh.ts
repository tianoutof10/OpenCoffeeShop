// Event-driven history sync: success and intentional pauses never schedule retries.
export function createHistoryRefresh(options: {
  refresh: (force: boolean, canContinue: () => boolean) => Promise<boolean | 'paused'>
  visible: () => boolean
  schedule: (callback: () => void, delay: number) => () => void
}) {
  let stopped = false
  let pending: Promise<void> | null = null
  let failures = 0
  let forceNext = false
  let cancelTimer: (() => void) | undefined
  const request = (force = false): Promise<void> => {
    if (stopped || !options.visible()) return Promise.resolve()
    if (pending) return force ? pending.then(() => request(true)) : pending
    forceNext ||= force
    cancelTimer?.()
    cancelTimer = undefined
    pending = Promise.resolve().then(() => stopped ? 'paused' as const : options.refresh(forceNext, () => !stopped && options.visible())).catch(() => false).then(success => {
      if (stopped) return
      if (success === 'paused') { failures = 0; return }
      if (success) {
        failures = 0
        forceNext = false
      } else {
        const delay = [5000, 15000, 30000, 60000][Math.min(failures++, 3)]
        cancelTimer = options.schedule(() => { void request() }, delay)
      }
    }).finally(() => { pending = null })
    return pending
  }
  return {
    request,
    retryFailed: () => { if (failures) void request() },
    stop: () => { stopped = true; cancelTimer?.() },
  }
}
