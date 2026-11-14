import test from 'node:test'
import assert from 'node:assert/strict'
import { saveErrorMessage } from '../lib/saveErrorMessage.js'

test('a known database error gets a plain sentence plus the real reason', () => {
  assert.equal(
    saveErrorMessage({ code: '23502', message: 'null value in column "name" violates not-null constraint' }),
    'A required field is empty. (null value in column "name" violates not-null constraint)',
  )
})

test('an unknown error still shows its reason', () => {
  assert.equal(saveErrorMessage({ code: 'XX000', message: 'boom' }), 'Could not save your changes. (boom)')
})

test('no detail, no error', () => {
  assert.equal(saveErrorMessage({ code: '42501' }), 'You do not have permission to change this. Please try again.')
  assert.equal(saveErrorMessage(null), 'Could not save your changes. Please try again.')
})

test('a very long reason is cut short', () => {
  assert.ok(saveErrorMessage({ message: 'x'.repeat(500) }).length < 200)
})
