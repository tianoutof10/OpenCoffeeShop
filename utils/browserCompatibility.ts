// Profiles and telemetry are JSON data. Keep optional undefined fields without
// requiring structuredClone, which older tablet WebViews do not provide.
export function cloneJsonData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneJsonData(item)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonData(item)])) as T
  }
  return value
}

interface RandomSource {
  getRandomValues(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>
}

export function createId(random: RandomSource = globalThis.crypto): string {
  const bytes = random.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
