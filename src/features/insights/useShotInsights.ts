import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getDecaidEndpoints } from '../../api/decaid/config'
import { shotToDomain } from '../../api/decaid/adapters'
import { browserHistoryStorage } from './historyStorage'
import { HistoryRepository } from './historyRepository'
import { readHistoryDetail, readHistoryPage } from './historyTransport'
import { startLatestChartRetry, type LatestChartStatus } from './latestChartRetry'
import { createHistoryRefresh } from './historyRefresh'
import { startDurationBackfill } from './durationBackfill'
import { BACKFILL_GAP_MS, createHistoryPacer } from './historyPacing'
import { readStageEvidence, withStageEvidence } from '../brew/stageEvidenceStorage'

export function useShotInsights(active: boolean, shotId: string) {
  const source = getDecaidEndpoints().apiBase
  const repository = useMemo(() => new HistoryRepository(source, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', {
    storage: browserHistoryStorage(), page: offset => readHistoryPage(source, offset), detail: id => readHistoryDetail(source, id), toDetail: shotToDomain,
    background: createHistoryPacer(),
    decorateDetail: detail => withStageEvidence(detail, readStageEvidence(source, detail.id)),
  }), [source])
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    // Advance date windows across midnight without requesting history from Decaid.
    const clock = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(clock)
  }, [active])
  const refreshController = useRef<ReturnType<typeof createHistoryRefresh> | null>(null)
  const previousShotId = useRef(shotId)
  const refreshHistory = useCallback((force = true) => refreshController.current?.request(force), [])
  useEffect(() => {
    void repository.load()
    if (!active) return
    const controller = createHistoryRefresh({
      refresh: async (force, canContinue) => {
        setNow(new Date())
        return repository.refresh(force, canContinue)
      },
      visible: () => document.visibilityState !== 'hidden',
      schedule: (callback, delay) => {
        const timer = window.setTimeout(callback, delay)
        return () => window.clearTimeout(timer)
      },
    })
    refreshController.current = controller
    const refresh = () => { void controller.request() }
    // Only a changed shot gets a settling delay; don't double-fetch on every entry.
    const newShot = !!shotId && previousShotId.current !== shotId
    previousShotId.current = shotId
    const settled = newShot ? window.setTimeout(refresh, 4000) : undefined
    if (!newShot) refresh()
    window.addEventListener('online', controller.retryFailed)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.stop()
      refreshController.current = null
      window.clearTimeout(settled)
      window.removeEventListener('online', controller.retryFailed)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [repository, active, shotId])
  useEffect(() => {
    if (!active || state.status !== 'ready') return
    const backfill = startDurationBackfill({
      batch: canContinue => repository.reconcileDurationBatch(canContinue),
      visible: () => document.visibilityState !== 'hidden',
      cooldown: repository.durationCooldown,
      minimumGapMs: BACKFILL_GAP_MS,
      schedule: (callback, delay) => {
        const timer = window.setTimeout(callback, delay)
        return () => window.clearTimeout(timer)
      },
    })
    window.addEventListener('online', backfill.resume)
    document.addEventListener('visibilitychange', backfill.resume)
    return () => {
      backfill.stop()
      window.removeEventListener('online', backfill.resume)
      document.removeEventListener('visibilitychange', backfill.resume)
    }
  }, [repository, active, state.status, state.cache?.syncedAt, shotId])
  const stageCacheStamp = state.cache?.syncedAt
  useEffect(() => {
    if (!active || !stageCacheStamp) return
    const backfill = startDurationBackfill({
      batch: canContinue => repository.reconcileStageReasonBatch(canContinue),
      visible: () => document.visibilityState !== 'hidden',
      schedule: (callback, delay) => {
        const timer = window.setTimeout(callback, delay)
        return () => window.clearTimeout(timer)
      },
    })
    document.addEventListener('visibilitychange', backfill.resume)
    return () => { backfill.stop(); document.removeEventListener('visibilitychange', backfill.resume) }
    // Cache changes from the batch itself must not restart the migration loop.
  }, [repository, active, stageCacheStamp, shotId])
  const latest = state.cache?.records.find(r => r.beverage !== 'excluded')
  const latestId = latest?.id
  const latestSignature = latest?.signature
  const latestCached = !!(latestId && state.cache?.details[latestId])
  const chartKey = `${latestId ?? ''}:${latestSignature ?? ''}`
  const [chartState, setChartState] = useState<{ key: string; status: LatestChartStatus } | null>(null)
  useEffect(() => {
    if (!active || !latestId || latestCached) return
    const retry = startLatestChartRetry({
      load: () => repository.detail(latestId),
      visible: () => document.visibilityState !== 'hidden',
      changed: status => setChartState({ key: chartKey, status }),
      schedule: (callback, delay) => {
        const timer = window.setTimeout(callback, delay)
        return () => window.clearTimeout(timer)
      },
    })
    window.addEventListener('online', retry.resume)
    document.addEventListener('visibilitychange', retry.resume)
    return () => {
      retry.stop()
      window.removeEventListener('online', retry.resume)
      document.removeEventListener('visibilitychange', retry.resume)
    }
  }, [active, repository, latestId, chartKey, latestCached])
  const latestChartStatus: LatestChartStatus = latestCached
    ? state.cache!.details[latestId!].points?.length ? 'ready' : 'empty'
    : chartState?.key === chartKey ? chartState.status : 'loading'
  return useMemo(() => ({ ...state, now, repository, latestChartStatus, refreshHistory }), [state, now, repository, latestChartStatus, refreshHistory])
}
export type ShotInsights = ReturnType<typeof useShotInsights>
