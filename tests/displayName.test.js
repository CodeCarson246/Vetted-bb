import test from 'node:test'
import assert from 'node:assert/strict'
import { safeDisplayName } from '../lib/displayName.js'

test('ordinary names pass through unchanged', () => {
  for (const name of ['Dana Clarke', "Jean-Luc O'Neil", 'Dr. A.J. Smith', 'Ministry of Works', 'Hinds Car Hire Ltd.', 'Élodie Brathwaite', 'St. Michael Plumbing & Co']) {
    assert.equal(safeDisplayName(name), name)
  }
})

test('nothing usable falls back', () => {
  for (const empty of [undefined, null, '', '   ', '\n\t']) assert.equal(safeDisplayName(empty), 'Someone')
  assert.equal(safeDisplayName('', 'the organisation'), 'the organisation')
  assert.equal(safeDisplayName('', ''), '')
})

test('a name is one line', () => {
  assert.equal(safeDisplayName('Ministry of Works\nBcc: someone'), 'Ministry of Works Bcc: someone')
  assert.equal(/[\r\n]/.test(safeDisplayName('line one\r\nline two')), false)
  assert.equal(safeDisplayName('  Dana \t  Clarke  '), 'Dana Clarke')
})

test('links are removed', () => {
  assert.equal(safeDisplayName('Dana https://evil.example/login Clarke'), 'Dana Clarke')
  assert.equal(safeDisplayName('Visit www.evil.example now'), 'Visit now')
  assert.equal(safeDisplayName('Claim at evil-site.com/prize today'), 'Claim at today')
  assert.equal(safeDisplayName('http://only-a-link.example'), 'Someone')
})

test('a name is at most 60 characters', () => {
  const long = safeDisplayName('URGENT your account is suspended please confirm your details immediately to restore access')
  assert.equal(long.length <= 60, true)
  assert.equal(long.endsWith('…'), true)
  assert.equal(safeDisplayName('x'.repeat(60)).length, 60)
})
