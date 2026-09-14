import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPhone } from '../lib/formatPhone.js'

test('Barbados and North American numbers print as (246) 833-1123', () => {
  for (const input of ['12468331123', '+12468331123', '+1 246 833 1123', '246-833-1123', '(246) 833 1123', '2468331123', '833-1123', '8331123']) {
    assert.equal(formatPhone(input), '(246) 833-1123', input)
  }
  assert.equal(formatPhone('+1 (305) 555-0199'), '(305) 555-0199')
})

test('anything it does not recognise is left exactly as typed', () => {
  assert.equal(formatPhone('+44 20 7946 0958'), '+44 20 7946 0958')
  assert.equal(formatPhone('246-833-1123 ext 4'), '246-833-1123 ext 4')
  assert.equal(formatPhone('12345'), '12345')
  assert.equal(formatPhone('  '), '')
  assert.equal(formatPhone(null), '')
})
