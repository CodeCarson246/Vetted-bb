import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDocumentHtml } from '../lib/documentHtml.js'
import { addDaysToDateOnly } from '../lib/formatDate.js'

const issuer = { name: 'Carson Pitts', company_name: 'Think Sports', trade: 'Sports Coach', location: 'saint james', email: 'c@example.com', avatar_url: 'https://x/a.jpg' }
const base = {
  quote_number: 'QT-20260913-493', quote_date: '2026-09-13', due_date: '2026-09-27',
  client_name: 'Jane Doe', client_email: 'jane@example.com', currency: 'BBD', verify_code: 'ABCDEFGHJK',
  items: [{ description: 'Coaching session', qty: 2, price: '40' }], total: 80,
}
const count = (html, needle) => html.split(needle).length - 1

test('a zero or missing price prints as Free in both cells', () => {
  const html = buildDocumentHtml({ ...base, items: [
    { description: 'Consultation', qty: 1, price: '' },
    { description: 'Warm-up plan', qty: 1, price: '0' },
    { description: 'Session', qty: 1, price: '40' },
  ], total: 40 }, issuer)
  assert.equal(count(html, '>Free</span>'), 4)
  assert.ok(html.includes('color:#22C55E;font-weight:600'))
  assert.equal(count(html, 'Bds$40.00'), 3) // unit + line for the priced row, total
  assert.ok(!html.includes('>Subtotal<')) // always equal to Total, so not printed
})

test('the document number appears once in the body, under the heading', () => {
  const html = buildDocumentHtml(base, issuer)
  const body = html.slice(html.indexOf('<body>'))
  assert.equal(count(body, 'QT-20260913-493'), 1)
  assert.ok(!body.includes('Quotation &middot;'))
  const inv = buildDocumentHtml({ ...base, invoice_number: 'INV-1', invoiced_at: '2026-09-14T10:00:00Z', invoice_due_date: '2026-09-28' }, issuer, { type: 'invoice' })
  const invBody = inv.slice(inv.indexOf('<body>'))
  assert.equal(count(invBody, 'INV-1'), 1)
  assert.ok(!invBody.includes('Invoice &middot;'))
})

test('quotes carry a validity date, defaulting to 30 days; invoices do not', () => {
  const html = buildDocumentHtml(base, issuer)
  assert.ok(html.includes('Valid until 13 October 2026'))
  const custom = buildDocumentHtml({ ...base, valid_until: '2026-09-20' }, issuer)
  assert.ok(custom.includes('Valid until 20 September 2026'))
  const inv = buildDocumentHtml({ ...base, invoice_number: 'INV-1', invoiced_at: '2026-09-14T10:00:00Z' }, issuer, { type: 'invoice' })
  assert.ok(!inv.includes('Valid until'))
})

test('date-only arithmetic rolls months and years without a timezone', () => {
  assert.equal(addDaysToDateOnly('2026-01-31', 30), '2026-03-02')
  assert.equal(addDaysToDateOnly('2026-12-20', 30), '2027-01-19')
  assert.equal(addDaysToDateOnly('', 30), null)
})

test('optional sections and lines appear only when filled', () => {
  const bare = buildDocumentHtml(base, issuer)
  for (const label of ['>Payment details<', '>Terms<', '>Notes<']) assert.ok(!bare.includes(label), label)
  assert.ok(!bare.includes('246-1234'))
  const full = buildDocumentHtml({ ...base, notes: 'Bring boots.', terms: '50% deposit.', client_phone: '246-1234', client_address: '12 Main Rd\nHoletown' },
    { ...issuer, payment_details: 'Bank transfer to RBC 123.' })
  for (const s of ['>Payment details<', 'Bank transfer to RBC 123.', '>Notes<', 'Bring boots.', '>Terms<', '50% deposit.', '246-1234', '12 Main Rd', 'Holetown']) assert.ok(full.includes(s), s)
  // terms sit after notes, in smaller muted type; payment details before notes
  assert.ok(full.indexOf('>Payment details<') < full.indexOf('>Notes<'))
  assert.ok(full.indexOf('>Notes<') < full.indexOf('>Terms<'))
  assert.ok(full.includes('font-size:0.75rem;color:#6b7280'))
})

test('avatar is a squircle and the verification block is unchanged', () => {
  const html = buildDocumentHtml(base, issuer)
  assert.ok(html.includes('border-radius:calc(14px * var(--s));object-fit:cover'))
  assert.ok(!html.includes('border-radius:50%'))
  assert.ok(html.includes('Verify this document'))
  assert.ok(html.includes('ABCDE-FGHJK'))
})

test('nothing is printed with a fixed height and blocks refuse to split', () => {
  const html = buildDocumentHtml(base, issuer)
  assert.ok(!/min-height|height:\s*\d+mm/.test(html.slice(0, html.indexOf('<body>'))))
  assert.ok(html.includes('@media print { body { padding:0; } :root { --s: var(--fit, 1); } }'))
  assert.ok(html.includes('.keep { break-inside:avoid'))
})

test('the printer chooses the paper, and a slightly long document shrinks to one sheet', () => {
  const html = buildDocumentHtml(base, issuer)
  const head = html.slice(0, html.indexOf('<body>'))
  // No forced A4: a US Letter printer must get a Letter layout, not a cropped A4 one.
  assert.ok(!/size\s*:\s*A4/i.test(head))
  // Fit runs before print, against the smallest page (A4 width, Letter height),
  // and never shrinks below 85% (a long document paginates instead).
  assert.ok(html.includes('var W = 650, H = 912, MIN = 0.85'))
  assert.ok(html.indexOf('try { fit() }') < html.indexOf('window.print()'))
})

test('From block: address before contact lines, parish only without an address, phone only when verified', () => {
  const verified = { ...issuer, phone: '246-555-0123', phone_verified: true }
  const withAddr = buildDocumentHtml({ ...base, from_address: '72 Waterhall Terrace\nApes Hill\nSaint James' }, verified)
  assert.ok(!withAddr.includes('>St. James<'))
  assert.ok(withAddr.indexOf('72 Waterhall Terrace') < withAddr.indexOf('246-555-0123'))
  assert.ok(withAddr.indexOf('246-555-0123') < withAddr.indexOf('c@example.com'))
  const noAddr = buildDocumentHtml(base, { ...issuer, phone: '246-555-0123', phone_verified: false })
  assert.ok(noAddr.includes('>St. James<'))
  assert.ok(!noAddr.includes('246-555-0123'))
})

test('Vetted.bb is not in the letterhead; the footer credits it with the yellow dot', () => {
  const html = buildDocumentHtml(base, issuer)
  const body = html.slice(html.indexOf('<body>'))
  assert.equal(body.split('Vetted<span').length - 1, 1)
  assert.ok(body.indexOf('Vetted<span') > body.indexOf('Verify this document'))
  assert.ok(body.includes('Issued through'))
  assert.ok(body.includes('Vetted<span style="color:#F9C000">.</span>bb'))
  assert.ok(!body.includes('Generated via'))
})

test('print fit scales sizes rather than zooming the page, and never rewrites user text', () => {
  const html = buildDocumentHtml(base, issuer)
  assert.ok(!/zoom/i.test(html.slice(0, html.indexOf('<body>'))))
  assert.ok(html.includes('font-size:calc(17px * var(--s))'))
  assert.ok(!/style="[^"]*\d+px[;"]/.test(html))
  const tricky = buildDocumentHtml({ ...base, notes: 'style="width:10px"' }, issuer)
  assert.ok(tricky.includes('style=&quot;width:10px&quot;'))
})
