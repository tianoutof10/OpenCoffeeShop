// Only background network work is paced. Interactive shot/chart reads bypass it.
export const PAGE_GAP_MS = 750
export const BACKFILL_GAP_MS = 4_000

export class HistoryPaused extends Error {
  constructor() { super('Background history paused'); this.name = 'HistoryPaused' }
}
export function assertHistoryActive(canContinue: () => boolean) {
  if (!canContinue()) throw new HistoryPaused()
}
type Wait = (ms: number) => Promise<void>
const wait: Wait = ms => new Promise(resolve => setTimeout(resolve, ms))
export type HistoryPacer = <T>(read: () => Promise<T>, canContinue: () => boolean) => Promise<T>

// One queue per repository/source for archive pages AND duration-detail reads.
// A stopped job exits after any pending wait, without starting another request.
// Already-issued requests may finish; cancelling a browser fetch cannot undo
// work already underway in Decaid, nor should it cancel a shared interactive read.
export function createHistoryPacer(gapMs = PAGE_GAP_MS, now: () => number = Date.now, sleep: Wait = wait): HistoryPacer {
  let queue: Promise<unknown> = Promise.resolve()
  let lastFinished = Number.NEGATIVE_INFINITY
  return <T>(read: () => Promise<T>, canContinue: () => boolean): Promise<T> => {
    const run = queue.then(async () => {
      assertHistoryActive(canContinue)
      while (lastFinished + gapMs > now()) {
        await sleep(lastFinished + gapMs - now())
        assertHistoryActive(canContinue)
      }
      assertHistoryActive(canContinue)
      try { return await read() } finally { lastFinished = now() }
    })
    queue = run.catch(() => undefined)
    return run
  }
}

// Keep this repository-owned across effect restarts (navigation, sync, wake).
export interface BackfillCooldown { nextAt: number }
