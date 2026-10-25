import { t } from '../../i18n/index.ts'
import type { HistoryCache } from './historyData.ts'
import { validHistoryCache } from './historyData.ts'
import { LEGACY_HISTORY_DATABASE_NAME } from '../../compatibility/legacyDataMigration.ts'

export interface HistoryStorage { read(source: string): Promise<HistoryCache | null>; write(cache: HistoryCache): Promise<void> }
let historyMigration: Promise<void> | undefined
function migrateHistoryDatabase() {
  if (historyMigration) return historyMigration
  historyMigration = (async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(LEGACY_HISTORY_DATABASE_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('sources', { keyPath: 'source' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    let records: unknown[]
    try {
      records = await new Promise((resolve, reject) => {
        const request = legacy.transaction('sources', 'readonly').objectStore('sources').getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } finally { legacy.close() }
    const current = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('opencoffeeshop-shot-history', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('sources', { keyPath: 'source' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      if (records.length) await new Promise<void>((resolve, reject) => {
        const transaction = current.transaction('sources', 'readwrite')
        for (const record of records) transaction.objectStore('sources').put(record)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } finally { current.close() }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(LEGACY_HISTORY_DATABASE_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('History migration is blocked by another tab'))
    })
  })().catch(() => { historyMigration = undefined })
  return historyMigration
}
export function browserHistoryStorage(): HistoryStorage {
  const open = async () => {
    await migrateHistoryDatabase()
    return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('opencoffeeshop-shot-history', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('sources', { keyPath: 'source' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(t('common.error.storageBusy')))
    })
  }
  return {
    async read(source) {
      const db = await open()
      try {
        return await new Promise<HistoryCache | null>((resolve, reject) => {
          const request = db.transaction('sources', 'readonly').objectStore('sources').get(source)
          request.onsuccess = () => {
            const value: unknown = request.result
            resolve(validHistoryCache(value, source) ? value : null)
          }
          request.onerror = () => reject(request.error)
        })
      } finally { db.close() }
    },
    async write(cache) {
      const db = await open()
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction('sources', 'readwrite')
          transaction.objectStore('sources').put(cache)
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
          transaction.onabort = () => reject(transaction.error)
        })
      } finally { db.close() }
    },
  }
}
