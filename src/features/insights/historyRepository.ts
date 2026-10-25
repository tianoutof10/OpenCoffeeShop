import { formatNumber, t } from '../../i18n/index.ts'
import type { PaginatedShots, ShotRecord } from '../../api/decaid/types.ts'
import type { PreviousShot } from '../../domain/brewing.ts'
import { attachDetail, HISTORY_LIMIT, normalizeShot, retainHistoryDetails, regroupHistory, reconcileCachedDurations, savedDuration, validHistoryCache, type HistoryCache } from './historyData.ts'
import type { HistoryStorage } from './historyStorage.ts'
import { syncHistory } from './historySync.ts'
import { reconcileStageReasons, STAGE_REASON_VERSION } from '../brew/stageMoveOn.ts'
import { reconcileCachedLabels, reconcileGeneratedLabels } from '../../i18n/dataLabels.ts'
import { assertHistoryActive, HistoryPaused, type BackfillCooldown, type HistoryPacer } from './historyPacing.ts'

export interface HistoryState { cache: HistoryCache | null; status: 'loading' | 'ready' | 'offline'; refreshing: boolean; storageWarning: boolean; error: string | null }
interface Dependencies {
  storage: HistoryStorage; page: (offset: number) => Promise<PaginatedShots>; detail: (id: string) => Promise<ShotRecord>
  toDetail: (shot: ShotRecord) => PreviousShot; now?: () => Date
  decorateDetail?: (shot: PreviousShot) => PreviousShot
  background?: HistoryPacer
}
export class HistoryRepository {
  readonly source: string
  readonly timezone: string
  private deps: Dependencies
  state: HistoryState = { cache: null, status: 'loading', refreshing: false, storageWarning: false, error: null }
  private listeners = new Set<() => void>()
  private boot: Promise<void> | null = null
  private refreshing: Promise<boolean | 'paused'> | null = null
  readonly durationCooldown: BackfillCooldown = { nextAt: 0 }
  private writes: Promise<void> = Promise.resolve()
  private loadingDetails = new Map<string, Promise<PreviousShot>>()
  private rawDetails = new Map<string, Promise<ShotRecord>>()
  private durationBatch: Promise<boolean> | null = null
  private stageBatch: Promise<boolean> | null = null
  constructor(source: string, timezone: string, dependencies: Dependencies) { this.source = source; this.timezone = timezone; this.deps = dependencies }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private update(patch: Partial<HistoryState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()) }
  load() {
    this.boot ??= this.deps.storage.read(this.source).then(async cache => {
      const valid = validHistoryCache(cache, this.source) ? reconcileCachedDurations(regroupHistory(reconcileCachedLabels(cache))) : null
      this.update({ cache: valid, status: valid ? 'offline' : 'loading' })
      if (valid && valid !== cache) await this.persist(valid)
    }).catch(() => this.update({ storageWarning: true }))
    return this.boot
  }
  private persist(cache: HistoryCache) {
    this.writes = this.writes.then(() => this.deps.storage.write(cache)).catch(() => this.update({ storageWarning: true }))
    return this.writes
  }
  private reconcileDetail(detail: PreviousShot, signature?: string) {
    return reconcileStageReasons(reconcileGeneratedLabels(this.deps.decorateDetail?.(detail) ?? detail, signature), signature)
  }
  // Offline-only migration: small resumable batches, no graph downloads. Missing
  // detail records remain eligible when their measurements are fetched later.
  reconcileStageReasonBatch(canContinue: () => boolean = () => true): Promise<boolean> {
    if (this.stageBatch) return this.stageBatch
    this.stageBatch = (async () => {
      await this.load()
      const current = this.state.cache
      if (!current) return true
      const needsReconciliation = (detail: PreviousShot | undefined) => detail?.points?.length && ((this.deps.decorateDetail?.(detail) ?? detail).stageReasons?.version !== STAGE_REASON_VERSION || Object.values(detail.stageReasons?.reasons ?? {}).some(reason => !reason.conditions))
      const pending = current.records.filter(r => needsReconciliation(current.details[r.id])).slice(0, 5)
      const details = { ...current.details }
      let changed = false
      for (const record of pending) {
        if (!canContinue()) break
        details[record.id] = this.reconcileDetail(details[record.id], record.signature)
        changed = true
      }
      if (changed) {
        const cache = { ...current, details }
        this.update({ cache })
        await this.persist(cache)
      }
      return !this.state.cache?.records.some(r => needsReconciliation(this.state.cache!.details[r.id]))
    })().finally(() => { this.stageBatch = null })
    return this.stageBatch
  }
  private background<T>(read: () => Promise<T>, canContinue: () => boolean): Promise<T> {
    assertHistoryActive(canContinue)
    return this.deps.background ? this.deps.background(read, canContinue) : read()
  }
  refresh(force = false, canContinue: () => boolean = () => true): Promise<boolean | 'paused'> {
    // A newly mounted caller must not inherit an older caller's paused request.
    // Explicit Refresh during an incremental pass still gets a full scan.
    if (this.refreshing) return this.refreshing.then(result => canContinue() && (result === 'paused' || force)
      ? this.refresh(force, canContinue) : result)
    this.refreshing = (async () => {
      await this.load()
      try {
        assertHistoryActive(canContinue)
        this.update({ refreshing: true })
        const next = await syncHistory(offset => this.background(() => this.deps.page(offset), canContinue), this.state.cache, this.source, this.state.cache?.timezone ?? this.timezone, this.deps.now?.() ?? new Date(), force, canContinue)
        assertHistoryActive(canContinue)
        const cache = retainHistoryDetails(next, this.state.cache)
        this.update({ cache, status: 'ready', error: null })
        await this.persist(cache)
        return true
      } catch (error) {
        if (error instanceof HistoryPaused || !canContinue()) return 'paused' as const
        this.update({ status: 'offline', error: error instanceof Error ? error.message : t('common.error.historyUnavailable') })
        return false
      } finally { this.update({ refreshing: false }); this.refreshing = null }
    })()
    return this.refreshing
  }
  private readDetail(id: string) {
    const pending = this.rawDetails.get(id)
    if (pending) return pending
    const request = Promise.resolve().then(() => this.deps.detail(id)).then(raw => {
      if (raw.id !== id || !Array.isArray(raw.measurements)) throw new Error(t('common.error.shotMeasurements'))
      return raw
    }).finally(() => this.rawDetails.delete(id))
    this.rawDetails.set(id, request)
    return request
  }
  // Migration v1: small, resumable batches. Keep only the duration, not 1,000 graphs.
  // The per-record marker also remembers genuinely missing data and survives releases.
  reconcileDurationBatch(canContinue: () => boolean = () => true): Promise<boolean> {
    if (this.durationBatch) return this.durationBatch
    this.durationBatch = (async () => {
      await this.load()
      const initial = this.state.cache
      if (!initial) return false
      const pending = initial.records.filter(r => r.duration === null && r.durationReconciled !== 1).slice(0, 5)
      const results = new Map<string, { signature: string; duration: number | null }>()
      try {
        for (const record of pending) {
          if (!canContinue()) break
          let duration: number | null = null
          const cached = this.state.cache?.details[record.id]
          if (cached) duration = savedDuration(cached)
          else {
            try {
              duration = await this.background(async () => {
                // An interactive read may have filled the cache during the wait.
                const current = this.state.cache
                const revision = current?.records.find(r => r.id === record.id)
                if (revision?.signature !== record.signature) throw new HistoryPaused()
                const cached = current?.details[record.id]
                if (cached) return savedDuration(cached)
                // Only actual in-flight reads are deduplicated. Interactive reads
                // never wait behind a queued background request for the same ID.
                const raw = await this.readDetail(record.id)
                const normalized = normalizeShot(raw, initial.timezone)
                if (normalized?.signature !== record.signature) throw new Error(t('common.error.shotChanged'))
                return savedDuration(this.deps.toDetail(raw))
              }, canContinue)
            } catch (error) {
              if (error instanceof HistoryPaused || !canContinue()) break
              // Deleted records must not block the rest of the archive. Transient failures retry.
              if (!(error instanceof Error && 'status' in error && error.status === 404)) throw error
            }
          }
          results.set(record.id, { signature: record.signature, duration })
        }
      } finally {
        const current = this.state.cache
        if (current && results.size) {
          const cache = { ...current, records: current.records.map(record => {
            const result = results.get(record.id)
            return result?.signature === record.signature
              ? { ...record, duration: record.duration ?? result.duration, durationReconciled: 1 as const }
              : record
          }) }
          this.update({ cache })
          await this.persist(cache)
        }
      }
      return !this.state.cache?.records.some(r => r.duration === null && r.durationReconciled !== 1)
    })().finally(() => { this.durationBatch = null })
    return this.durationBatch
  }
  detail(id: string) {
    const inFlight = this.loadingDetails.get(id)
    if (inFlight) return inFlight
    const operation = (async () => {
      await this.load()
      const initial = this.state.cache
      const record = initial?.records.find(r => r.id === id)
      if (!initial || !record) throw new Error(t('common.error.shotOutsideCache', { count: formatNumber(HISTORY_LIMIT) }))
      // Summaries are reconciled on entry/refresh. A cached detail shares that revision.
      if (Object.prototype.hasOwnProperty.call(initial.details, id)) {
        const detail = this.reconcileDetail(initial.details[id], record.signature)
        if (detail !== initial.details[id]) {
          const cache = attachDetail(initial, id, record.signature, detail)
          this.update({ cache })
          await this.persist(cache)
        }
        return detail
      }
      const raw = await this.readDetail(id)
      const normalized = normalizeShot(raw, initial.timezone)
      if (!normalized) throw new Error(t('common.error.shotIdentity'))
      const detail = this.reconcileDetail(this.deps.toDetail(raw), normalized.signature)
      const current = this.state.cache
      if (current?.records.some(r => r.id === id && r.signature === record.signature)) {
        const updated = { ...current, records: current.records.map(r => r.id === id ? normalized : r) }
        const cache = attachDetail(updated, id, normalized.signature, detail)
        this.update({ cache })
        await this.persist(cache)
      }
      return detail
    })().finally(() => this.loadingDetails.delete(id))
    this.loadingDetails.set(id, operation)
    return operation
  }
}
