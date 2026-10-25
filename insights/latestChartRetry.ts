import { t } from '../../i18n/index.ts'

export type LatestChartStatus = 'loading' | 'retrying' | 'waiting' | 'ready' | 'empty'

// One request at a time; keep retrying transient failures without polling cached graphs.
export function startLatestChartRetry(options: {
  load: () => Promise<{ points?: unknown[] }>
  visible: () => boolean
  changed: (status: LatestChartStatus) => void
  schedule: (callback: () => void, delay: number) => () => void
}) {
  let stopped = false
  let complete = false
  let pending = false
  let failures = 0
  let cancelTimer: (() => void) | undefined
  const run = async () => {
    if (stopped || complete || pending || !options.visible()) return
    cancelTimer?.()
    cancelTimer = undefined
    pending = true
    options.changed(failures ? 'retrying' : 'loading')
    try {
      const shot = await options.load()
      if (stopped) return
      complete = true
      options.changed(shot.points?.length ? 'ready' : 'empty')
    } catch {
      if (stopped) return
      const delay = [5000, 15000, 30000, 60000][Math.min(failures++, 3)]
      options.changed('waiting')
      cancelTimer = options.schedule(() => { void run() }, delay)
    } finally { pending = false }
  }
  void run()
  return {
    resume: () => { void run() },
    stop: () => { stopped = true; cancelTimer?.() },
  }
}

export function latestChartMessage(status: LatestChartStatus) {
  if (status === 'waiting') return t('insights.chart.unavailableRetrying')
  if (status === 'retrying') return t('insights.chart.retrying')
  if (status === 'empty') return t('insights.chart.empty')
  return t('insights.chart.loading')
}
