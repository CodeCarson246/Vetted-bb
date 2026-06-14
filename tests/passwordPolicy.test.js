import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePassword, passwordChecks } from '../lib/passwordPolicy.js'

test('rejects passwords under 8 characters', () => {
  assert.equal(validatePassword('Pass12', {}).valid, false) // 6 chars
  assert.equal(passwordChecks('Pass12', {}).length, false)
})

test('requires an uppercase letter', () => {
  assert.equal(validatePassword('password1', {}).valid, false)
  assert.equal(passwordChecks('password1', {}).uppercase, false)
})

test('requires a mix of letters and numbers', () => {
  assert.equal(passwordChecks('Password', {}).letterNumber, false) // no digit
  assert.equal(passwordChecks('12345678', {}).letterNumber, false) // no letter
  assert.equal(passwordChecks('Password1', {}).letterNumber, true)
})

test('accepts a compliant password', () => {
  assert.equal(validatePassword('Password1', {}).valid, true)
  assert.equal(validatePassword('Abc12345', {}).valid, true)
})

test('rejects passwords containing the user name', () => {
  const r = validatePassword('JaneSmith1A', { name: 'Jane Smith', email: 'x@y.com' })
  assert.equal(r.valid, false)
  assert.equal(r.checks.noPersonal, false)
})

test('rejects passwords containing the email local-part', () => {
  const r = validatePassword('jane123ABc', { name: '', email: 'jane@example.com' })
  assert.equal(r.checks.noPersonal, false)
})

test('short name/email fragments do not trigger the personal check', () => {
  // 2-char name parts are ignored to avoid false positives
  assert.equal(passwordChecks('Goodpass1', { name: 'Al Bo', email: 'al@x.com' }).noPersonal, true)
})
