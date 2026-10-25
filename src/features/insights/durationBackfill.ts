import type { BackfillCooldown } from './historyPacing.ts'

export function startDurationBackfill(options: {
  batch: (canContinue: () => boolean) => Promise<boolean>
  visible: () => boolean
  schedule: (callback: () => void, delay: number) => () => void
  cooldown?: BackfillCooldown
  minimumGapMs?: number
  now?: () => number
}) {
  let stopped = false, running = false, complete = false, failures = 0
  const cooldown = options.cooldown ?? { nextAt: 0 }
  const now = options.now ?? Date.now
  let cancel: (() => void) | undefined
  const canContinue = () => !stopped && options.visible()
  const resume = () => {
    if (!canContinue() || running || complete) return
    cancel?.()
    cancel = undefined
    const remaining = cooldown.nextAt - now()
    if (remaining > 0) {
      cancel = options.schedule(resume, remaining)
      return
    }
    running = true
    void Promise.resolve().then(() => canContinue() ? options.batch(canContinue) : false).then(done => {
      complete = done
      failures = 0
    }).catch(() => { failures++ }).finally(() => {
      running = false
      const delay = Math.max(options.minimumGapMs ?? 1000, failures ? [5000, 15000, 30000, 60000][Math.min(failures - 1, 3)] : 0)
      cooldown.nextAt = Math.max(cooldown.nextAt, now() + delay)
      if (canContinue() && !complete) cancel = options.schedule(resume, delay)
    })
  }
  resume()
  return { resume, stop: () => { stopped = true; cancel?.() } }
}
