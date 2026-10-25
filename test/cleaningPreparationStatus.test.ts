import assert from 'node:assert/strict'
import test from 'node:test'
import { cleaningPreparationStatus, prepareCleaningProfileForEspressoStart } from '../src/features/cleaning/cleaningSequence.ts'

test('cleaning selection is not ready until the chosen profile is prepared', () => {
  assert.equal(cleaningPreparationStatus(null, false, null, null), 'idle')
  assert.equal(cleaningPreparationStatus('a', false, null, null), 'idle')
  assert.equal(cleaningPreparationStatus('a', true, null, null), 'loading')
  assert.equal(cleaningPreparationStatus('a', false, 'a', null), 'ready')
  assert.equal(cleaningPreparationStatus('b', true, 'a', null), 'loading')
  assert.equal(cleaningPreparationStatus('b', false, 'a', 'b'), 'error')
  assert.equal(cleaningPreparationStatus('b', true, null, 'b'), 'loading')
  assert.equal(cleaningPreparationStatus('b', false, 'b', null), 'ready')
})

test('cleaning preparation waits for the actual upload and propagates its failure', async () => {
  const profile = { title: 'Cleaning/Forward Flush x5', beverage_type: 'cleaning' }
  let reject!: (reason: Error) => void
  const upload = new Promise<void>((_resolve, fail) => { reject = fail })
  let finished = false
  const prepare = prepareCleaningProfileForEspressoStart(profile, {
    selectWorkflow: async () => ({ profile }), uploadProfile: () => upload,
  }).then(() => { finished = true })
  await Promise.resolve()
  assert.equal(finished, false)
  reject(new Error('Machine upload failed'))
  await assert.rejects(prepare, /Machine upload failed/)
  assert.equal(finished, false)
})
