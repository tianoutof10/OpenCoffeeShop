/** One-time compatibility bridge for data saved by earlier app versions. */
export const LEGACY_PROFILE_METADATA_KEYS = {
  source: 'bestpressoSource',
  createdAt: 'bestpressoCreatedAt',
  targetYield: 'bestpressoTargetYield',
  chassis: 'bestpressoChassis',
  preset: 'bestpressoPreset',
} as const
export const LEGACY_HISTORY_DATABASE_NAME = 'bestpresso-shot-history'
export const LEGACY_LAST_SELECTED_PROFILE_SHARED_KEY = 'bestpresso-last-selected-profile'

export function migrateProfileMetadata(metadata: Record<string, unknown> | null | undefined) {
  const migrated = { ...(metadata ?? {}) }
  const moves = [
    [LEGACY_PROFILE_METADATA_KEYS.source, 'openCoffeeShopSource'],
    [LEGACY_PROFILE_METADATA_KEYS.createdAt, 'openCoffeeShopCreatedAt'],
    [LEGACY_PROFILE_METADATA_KEYS.targetYield, 'openCoffeeShopTargetYield'],
    [LEGACY_PROFILE_METADATA_KEYS.chassis, 'openCoffeeShopChassis'],
    [LEGACY_PROFILE_METADATA_KEYS.preset, 'openCoffeeShopPreset'],
  ] as const
  for (const [legacy, current] of moves) {
    if (migrated[current] === undefined && migrated[legacy] !== undefined) migrated[current] = migrated[legacy]
    delete migrated[legacy]
  }
  return migrated
}

const storageMoves = [
  ['bestpresso.preferences.v1', 'opencoffeeshop.preferences.v1'],
  ['bestpressoGateway', 'openCoffeeShopGateway'],
  ['bestpresso.last-selected-profile-id.v1', 'opencoffeeshop.last-selected-profile-id.v1'],
  ['bestpresso.favorite-profile-ids.v1', 'opencoffeeshop.favorite-profile-ids.v1'],
  ['bestpresso.utility-layout-collapsed.v1', 'opencoffeeshop.utility-layout-collapsed.v1'],
  ['bestpresso.value-adjustment-suggestions.v2', 'opencoffeeshop.value-adjustment-suggestions.v2'],
  ['bestpresso.fullscreen-prompt-dismissed.v1', 'opencoffeeshop.fullscreen-prompt-dismissed.v1'],
  ['bestpresso.decaid-update-dismissed', 'opencoffeeshop.decaid-update-dismissed'],
  ['bestpresso:display-brightness', 'opencoffeeshop:display-brightness'],
  ['bestpresso-coffee-v1:', 'opencoffeeshop-coffee-v1:'],
  ['bestpresso-pace-v1:', 'opencoffeeshop-pace-v1:'],
  ['bestpresso-stage-evidence-v1:', 'opencoffeeshop-stage-evidence-v1:'],
] as const

export function migrateLegacyBrowserData() {
  if (typeof window === 'undefined') return
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      for (const [legacy, current] of storageMoves) {
        if (legacy.endsWith(':')) {
          const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key?.startsWith(legacy)))
          for (const oldKey of keys) {
            const newKey = `${current}${oldKey.slice(legacy.length)}`
            if (storage.getItem(newKey) === null) storage.setItem(newKey, storage.getItem(oldKey) ?? '')
            storage.removeItem(oldKey)
          }
        } else {
          const oldValue = storage.getItem(legacy)
          if (oldValue !== null) {
            if (storage.getItem(current) === null) storage.setItem(current, oldValue)
            storage.removeItem(legacy)
          }
        }
      }
    } catch { /* Storage may be disabled; runtime readers retain compatibility. */ }
  }
}
