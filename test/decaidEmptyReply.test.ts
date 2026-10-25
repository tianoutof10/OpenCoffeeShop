import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseJsonBody } from '../src/api/decaid/jsonBody.ts'

// POST /api/v1/machine/settings/advanced answers 202 Accepted with
// content-type: application/json and content-length: 0. The settings screen
// reported "Unexpected end of JSON input" for a write that had already reached
// the machine.
test('an empty JSON-typed reply is no body, not an error', () => {
  assert.equal(parseJsonBody(''), undefined)
  assert.equal(parseJsonBody('  \n'), undefined)
})

test('a reply with a body is still parsed', () => {
  assert.deepEqual(parseJsonBody('{"stopHotWaterAtWeight":true}'), { stopHotWaterAtWeight: true })
})

test('JSON writes go through the tolerant parser', () => {
  const client = readFileSync(new URL('../src/api/decaid/client.ts', import.meta.url), 'utf8')
  const postJson = client.slice(client.indexOf('async function postJson'), client.indexOf('export const updateSettings'))
  assert.match(postJson, /parseJsonBody<T>\(await response\.text\(\)\)/)
  assert.doesNotMatch(postJson, /response\.json\(\)/)
})
