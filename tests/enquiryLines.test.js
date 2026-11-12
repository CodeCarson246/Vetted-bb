import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceEnquiryLine, parseServiceEnquiryLine } from '../lib/enquiryLines.js'
import { parseRentalLine } from '../lib/rentals.js'

test('what the profile writes, the inbox can read back', () => {
  for (const [name, price, expected] of [
    ['One to one coaching', '40', 40],
    ['Free consultation', '0', 0],
    ['Lawn cut', 75.5, 75.5],
    ['Roof repair', '$1,200', 1200],
    ['Logo design', 'From 350', 350],
  ]) {
    const line = serviceEnquiryLine(name, price)
    assert.deepEqual(parseServiceEnquiryLine(line), { name, price: expected }, line)
  }
})

test('the exact lines from a real enquiry are understood', () => {
  // These are the lines that stopped producing a "Quote this service" button.
  assert.deepEqual(parseServiceEnquiryLine('• One to one coaching: Bds$40'), { name: 'One to one coaching', price: 40 })
  assert.deepEqual(parseServiceEnquiryLine('• Free consultation: Bds$0'), { name: 'Free consultation', price: 0 })
})

test('every form the line has taken still parses', () => {
  assert.deepEqual(parseServiceEnquiryLine('• Lawn cut: $75'), { name: 'Lawn cut', price: 75 })
  assert.deepEqual(parseServiceEnquiryLine('• Lawn cut: 75'), { name: 'Lawn cut', price: 75 })
  assert.deepEqual(parseServiceEnquiryLine('- Lawn cut: BBD $75.50'), { name: 'Lawn cut', price: 75.5 })
  assert.deepEqual(parseServiceEnquiryLine('* Lawn cut: bds$1,250.00'), { name: 'Lawn cut', price: 1250 })
  assert.deepEqual(parseServiceEnquiryLine('• Site visit: Bds$120+'), { name: 'Site visit', price: 120 })
  assert.deepEqual(parseServiceEnquiryLine('• Web design: basic package: Bds$900'), { name: 'Web design: basic package', price: 900 })
})

test('lines that are not a priced service are left alone', () => {
  assert.equal(parseServiceEnquiryLine('Estimated total: $40'), null)
  assert.equal(parseServiceEnquiryLine('Hi Carson, I am interested in the following services:'), null)
  assert.equal(parseServiceEnquiryLine('• Custom work: Call for price'), null)
  assert.equal(parseServiceEnquiryLine('Could you confirm availability and pricing?'), null)
  assert.equal(parseServiceEnquiryLine(''), null)
  assert.equal(parseServiceEnquiryLine(null), null)
})

test('a price that is not a number is passed through as written', () => {
  assert.equal(serviceEnquiryLine('Custom work', 'Call for price'), '• Custom work: Call for price')
})

test('a rental line is still read as a rental, not as a plain service', () => {
  const line = '• Suzuki Swift, 3 days, Fri 13 Nov to Sun 15 Nov: 3 x $75.00'
  assert.deepEqual(parseRentalLine(line), { description: 'Suzuki Swift, 3 days, Fri 13 Nov to Sun 15 Nov', qty: 3, price: 75 })
  assert.equal(parseServiceEnquiryLine(line), null)
})
