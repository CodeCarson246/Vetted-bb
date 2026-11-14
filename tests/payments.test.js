import test from 'node:test'
import assert from 'node:assert/strict'
import {
  jobTotal, depositAmount, quoteDeposit, depositLabel, depositInvoiceColumns, invoicesOf, invoiceFor, amountPaid,
  jobOutstanding, invoiceBalance, invoicePaymentStatus, jobPaymentStatus, canRaiseBalance, invoiceToPay, money2,
} from '../lib/payments.js'

test('deposit amounts: percentage, fixed, and nonsense', () => {
  assert.equal(depositAmount(2000, 'percent', 50), 1000)
  assert.equal(depositAmount(333.33, 'percent', 50), 166.67)
  assert.equal(depositAmount(2000, 'percent', 150), 2000)
  assert.equal(depositAmount(2000, 'fixed', 750), 750)
  assert.equal(depositAmount(2000, 'fixed', 5000), 2000)
  for (const [t, v] of [[null, 50], ['percent', 0], ['percent', -5], ['fixed', 'abc'], ['other', 10]]) {
    assert.equal(depositAmount(2000, t, v), 0)
  }
  assert.equal(depositAmount(0, 'percent', 50), 0)
})

test('a deposit of the whole total is no deposit', () => {
  assert.equal(quoteDeposit({ total: 2000, deposit_type: 'percent', deposit_value: 100 }), 0)
  assert.equal(quoteDeposit({ total: 2000, deposit_type: 'fixed', deposit_value: 2000 }), 0)
  assert.equal(quoteDeposit({ total: 2000, deposit_type: 'percent', deposit_value: 50 }), 1000)
  assert.equal(quoteDeposit({ total: 2000 }), 0)
  assert.deepEqual(depositInvoiceColumns({ total: 2000 }), {})
  assert.deepEqual(depositInvoiceColumns({ total: 2000, deposit_type: 'percent', deposit_value: 50 }), { is_deposit: true, invoice_amount: 1000 })
  assert.equal(depositLabel({ deposit_type: 'percent', deposit_value: 50 }), 'Deposit required (50%)')
  assert.equal(depositLabel({ deposit_type: 'fixed', deposit_value: 750 }), 'Deposit required')
})

const plain = { total: 2000, invoice_number: 'INV-1', invoiced_at: '2026-11-01T12:00:00Z', invoice_due_date: '2026-11-15', amount_paid: 0 }
const deposit = { total: 2000, invoice_number: 'INV-D', is_deposit: true, invoice_amount: 1000, amount_paid: 0 }

test('an ordinary invoice works as before', () => {
  assert.deepEqual(invoicesOf(plain).map(i => [i.kind, i.number, i.amount]), [['full', 'INV-1', 2000]])
  assert.equal(jobPaymentStatus(plain), 'unpaid')
  assert.equal(jobPaymentStatus({ ...plain, amount_paid: 500 }), 'part-paid')
  assert.equal(jobOutstanding({ ...plain, amount_paid: 500 }), 1500)
  assert.equal(jobPaymentStatus({ ...plain, amount_paid: 2000 }), 'paid')
  assert.deepEqual(invoicesOf({ total: 10 }), [])
})

test('a job marked paid before part payments existed reads as paid in full', () => {
  const legacy = { ...plain, paid_at: '2026-11-05T12:00:00Z', amount_paid: 0 }
  assert.equal(amountPaid(legacy), 2000); assert.equal(jobOutstanding(legacy), 0); assert.equal(jobPaymentStatus(legacy), 'paid')
})

test('deposit job: deposit first, then the balance', () => {
  assert.deepEqual(invoicesOf(deposit).map(i => [i.kind, i.amount]), [['deposit', 1000]])
  assert.equal(canRaiseBalance(deposit), false)
  const part = { ...deposit, amount_paid: 400 }
  assert.equal(invoicePaymentStatus(part, invoicesOf(part)[0]), 'part-paid')
  assert.equal(canRaiseBalance(part), false)
  const depPaid = { ...deposit, amount_paid: 1000 }
  assert.equal(invoicePaymentStatus(depPaid, invoicesOf(depPaid)[0]), 'paid')
  assert.equal(jobPaymentStatus(depPaid), 'part-paid')
  assert.equal(canRaiseBalance(depPaid), true)

  const withBalance = { ...depPaid, balance_invoice_number: 'INV-B', balance_invoice_due_date: '2026-12-01' }
  assert.equal(canRaiseBalance(withBalance), false)
  const [d, b] = invoicesOf(withBalance)
  assert.deepEqual([b.kind, b.number, b.amount], ['balance', 'INV-B', 1000])
  assert.deepEqual(invoiceBalance(withBalance, d), { paid: 1000, outstanding: 0 })
  assert.deepEqual(invoiceBalance(withBalance, b), { paid: 0, outstanding: 1000 })
  assert.equal(invoiceToPay(withBalance).number, 'INV-B')

  const balPart = { ...withBalance, amount_paid: 1250 }
  assert.deepEqual(invoiceBalance(balPart, b), { paid: 250, outstanding: 750 })
  assert.equal(invoicePaymentStatus(balPart, b), 'part-paid')

  const done = { ...withBalance, amount_paid: 2000 }
  assert.equal(invoicePaymentStatus(done, b), 'paid'); assert.equal(jobPaymentStatus(done), 'paid')
})

test('invoiceFor finds by number, else the latest', () => {
  const both = { ...deposit, amount_paid: 1000, balance_invoice_number: 'INV-B' }
  assert.equal(invoiceFor(both, 'INV-D').kind, 'deposit')
  assert.equal(invoiceFor(both, 'INV-B').kind, 'balance')
  assert.equal(invoiceFor(both).kind, 'balance')
  assert.equal(invoiceFor({ total: 5 }), null)
})

test('money2', () => {
  assert.equal(money2(1000), '1000.00'); assert.equal(money2('12.345'), '12.35'); assert.equal(money2(null), '0.00')
})

test('outstanding summary: per invoice, net of part payments, with overdue counted in Barbados days', async () => {
  const { outstandingSummary } = await import('../lib/payments.js')
  const jobs = [
    { invoice_number: 'A', total: 1000, amount_paid: 250, invoice_due_date: '2026-11-10' },              // 750, overdue
    { invoice_number: 'B', total: 500, amount_paid: 0, invoice_due_date: '2026-11-20' },                 // 500
    { invoice_number: 'C', total: 300, paid_at: '2026-11-01T12:00:00Z', invoice_due_date: '2026-10-01' }, // paid: nothing
    { quote_number: 'Q', total: 900 },                                                                    // not invoiced: nothing
    { invoice_number: 'D', total: 2000, is_deposit: true, invoice_amount: 1000, amount_paid: 1000, invoice_due_date: '2026-11-01' }, // deposit paid, balance not invoiced
    { invoice_number: 'E', total: 2000, is_deposit: true, invoice_amount: 1000, amount_paid: 1000, invoice_due_date: '2026-11-01',
      balance_invoice_number: 'E2', balance_invoice_due_date: '2026-11-13' },                             // balance 1000, due today: not overdue
  ]
  assert.deepEqual(outstandingSummary(jobs, '2026-11-13'), { amount: 2250, invoices: 3, overdue: 1 })
  assert.deepEqual(outstandingSummary([], '2026-11-13'), { amount: 0, invoices: 0, overdue: 0 })
})

// Values the database now refuses (SQL Sections 44 and 47). The arithmetic is
// safe against them anyway, in case a row ever carries one.
test('bad stored values never print a negative or infinite invoice', () => {
  const tooBig = { total: 1000, invoice_number: 'D', is_deposit: true, invoice_amount: 5000, balance_invoice_number: 'B', amount_paid: 0 }
  assert.deepEqual(invoicesOf(tooBig).map(i => i.amount), [1000, 0])
  assert.equal(jobTotal({ total: 1000, billed_expenses_total: -900 }), 1000)
  assert.equal(jobTotal({ total: Infinity }), 0)
  assert.equal(jobTotal({ total: 'abc', billed_expenses_total: NaN }), 0)
  // a job marked paid is paid in full, whatever its payment rows add up to
  const ticked = { total: 1000, invoice_number: 'I', paid_at: '2026-01-20T12:00:00Z', amount_paid: 10 }
  assert.equal(amountPaid(ticked), 1000); assert.equal(jobOutstanding(ticked), 0)
})
