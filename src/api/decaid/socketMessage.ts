export function receiveSocketMessage<T>(raw: unknown, path: string, onData: (data: T) => void) {
  let data: T
  try { data = JSON.parse(String(raw)) as T }
  catch { return }
  try { onData(data) }
  catch (error) { console.error(`Decaid ${path} message handler failed`, error) }
}
