import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { cloneJsonData, createId } from '../src/utils/browserCompatibility.ts'
import { receiveSocketMessage } from '../src/api/decaid/socketMessage.ts'

test('profile data clones without structuredClone and keeps optional values', () => {
  const original = globalThis.structuredClone
  globalThis.structuredClone = undefined as unknown as typeof structuredClone
  try {
    const data = [{ name: 'Fill', exit: { value: 4 }, limiter: undefined, tags: ['a'], weight: null }]
    const copy = cloneJsonData(data)
    assert.deepEqual(copy, data)
    copy[0].exit.value = 8
    copy[0].tags.push('b')
    assert.equal(data[0].exit.value, 4)
    assert.deepEqual(data[0].tags, ['a'])
  } finally { globalThis.structuredClone = original }
})

test('IDs work with getRandomValues when randomUUID is unavailable', () => {
  const random = { getRandomValues: (bytes: Uint8Array) => { bytes.fill(255); return bytes } }
  assert.equal(createId(random), 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  const ids = Array.from({ length: 100 }, () => createId({ getRandomValues: bytes => crypto.getRandomValues(bytes) }))
  assert.equal(new Set(ids).size, ids.length)
  ids.forEach(id => assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/))
})

test('both socket subscribers report handler failures rather than treating them as bad JSON', () => {
  const errors: unknown[][] = []
  const original = console.error
  console.error = (...args) => { errors.push(args) }
  try {
    let received = 0
    receiveSocketMessage('invalid JSON', '/machine/snapshot', () => { received++ })
    assert.equal(received, 0)
    assert.equal(errors.length, 0)
    const failure = new Error('handler failed')
    receiveSocketMessage('{}', '/machine/snapshot', () => { throw failure })
    assert.equal(errors.length, 1)
    assert.equal(errors[0][1], failure)
    receiveSocketMessage('{}', '/machine/snapshot', () => { received++ })
    assert.equal(received, 1)
    const socket = readFileSync(new URL('../src/api/decaid/socket.ts', import.meta.url), 'utf8')
    assert.equal(socket.match(/receiveSocketMessage\(event.data, path, onData\)/g)?.length, 2)
  } finally { console.error = original }
})

test('live shots, builder and history do not require unsupported browser built-ins', () => {
  for (const path of ['features/brew/useBrewingData.ts', 'features/profiles/profileBuilderModel.ts', 'features/insights/historyRepository.ts', 'api/decaid/adapters.ts']) {
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /structuredClone\(|Object\.hasOwn\(|crypto\.randomUUID\(/)
  }
})
