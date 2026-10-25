import { t } from '../../i18n/index.ts'
import type { PaginatedShots } from '../../api/decaid/types.ts'
import { canonical, HISTORY_LIMIT, HISTORY_PAGE_SIZE, mergeRecentHistory, reconcileHistory, type HistoryCache } from './historyData.ts'
import { assertHistoryActive } from './historyPacing.ts'

// Between full passes only the newest page is read and merged; the full ten-page pull
// competes with the machine and scale for Decaid's attention, so it runs rarely.
export const FULL_HISTORY_INTERVAL = 6 * 60 * 60 * 1000
class HistoryChanged extends Error {
  constructor() { super(t('common.error.historyChanged')) }
}

function checkPage(page: PaginatedShots, offset: number) {
  if (!page || !Array.isArray(page.items) || page.offset !== offset || page.limit !== HISTORY_PAGE_SIZE || !Number.isInteger(page.total) || page.total < 0
    || page.items.length !== Math.min(HISTORY_PAGE_SIZE, Math.max(0, page.total - offset))) throw new Error(t('common.error.incompleteHistorySaved'))
  if (new Set(page.items.map(r => r.id)).size !== page.items.length) throw new HistoryChanged()
}

// Offset pagination has no snapshot token. Check totals/duplicate IDs and re-read
// the head before committing, retrying once if a new shot shifts page boundaries.
export async function syncHistory(read: (offset: number) => Promise<PaginatedShots>, previous: HistoryCache | null, source: string, timezone: string, now: Date, force = false, canContinue: () => boolean = () => true): Promise<HistoryCache> {
  const readPage = async (offset: number) => {
    assertHistoryActive(canContinue)
    const page = await read(offset)
    assertHistoryActive(canContinue)
    return page
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const head = await readPage(0)
      checkPage(head, 0)
      const elapsed = previous?.fullSyncedAt ? now.getTime() - Date.parse(previous.fullSyncedAt) : Infinity
      if (!force && attempt === 0 && previous?.source === source && elapsed >= 0 && elapsed < FULL_HISTORY_INTERVAL) {
        const recent = mergeRecentHistory(head, previous, now)
        if (recent) return recent
      }
      const items = [...head.items]
      const target = Math.min(head.total, HISTORY_LIMIT)
      for (let offset = HISTORY_PAGE_SIZE; offset < target; offset += HISTORY_PAGE_SIZE) {
        const page = await readPage(offset)
        if (page.total !== head.total) throw new HistoryChanged()
        checkPage(page, offset)
        items.push(...page.items)
      }
      if (new Set(items.map(r => r.id)).size !== items.length) throw new HistoryChanged()
      if (target > HISTORY_PAGE_SIZE) {
        const check = await readPage(0)
        checkPage(check, 0)
        if (check.total !== head.total || canonical(check.items) !== canonical(head.items)) throw new HistoryChanged()
      }
      return reconcileHistory({ items, total: head.total, limit: HISTORY_LIMIT, offset: 0 }, previous, source, timezone, now)
    } catch (error) {
      if (!(error instanceof HistoryChanged) || attempt === 1) throw error
    }
  }
  throw new HistoryChanged()
}
