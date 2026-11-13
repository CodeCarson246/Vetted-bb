import test from 'node:test'
import assert from 'node:assert/strict'
import { isUuid, isFresh, claimNotification, signedInUser, NOTIFY_WINDOW_MS } from '../lib/serverNotifyGuard.js'
import { enquiryNoticeFromMessage, enquiryNoticeFromReply, replyNoticeKind } from '../lib/notifyContent.js'
import { newId } from '../lib/newId.js'
import { invoiceReplyBody } from '../lib/invoicing.js'

const ID = '3f2b8c1e-5a4d-4e6f-9a7b-0c1d2e3f4a5b'

test('isUuid accepts an id and nothing else', () => {
  assert.equal(isUuid(ID), true)
  assert.equal(isUuid(ID.toUpperCase()), true)
  for (const bad of [undefined, null, '', 42, {}, 'abc', `${ID} `, `${ID}; drop table messages`, ID.slice(1)]) {
    assert.equal(isUuid(bad), false, String(bad))
  }
})

test('newId makes ids the routes accept, and different ones each time', () => {
  const a = newId(), b = newId()
  assert.equal(isUuid(a), true)
  assert.notEqual(a, b)
  assert.equal(a[14], '4')
})

test('isFresh: only rows from the last five minutes', () => {
  const now = Date.parse('2026-11-12T15:00:00Z')
  assert.equal(isFresh('2026-11-12T14:59:30+00:00', now), true)
  assert.equal(isFresh('2026-11-12T14:55:00+00:00', now), true)
  assert.equal(isFresh('2026-11-12T14:54:59+00:00', now), false)
  assert.equal(isFresh('2026-11-01T09:00:00+00:00', now), false)
  assert.equal(NOTIFY_WINDOW_MS, 5 * 60_000)
})

test('isFresh reads a time with no zone as UTC (messages.created_at)', () => {
  const now = Date.parse('2026-11-12T15:00:00Z')
  assert.equal(isFresh('2026-11-12T14:58:00', now), true)
  assert.equal(isFresh('2026-11-12T14:58:00.123456', now), true)
  assert.equal(isFresh('2026-11-12T10:58:00', now), false)
})

test('isFresh: a row with no usable time is not announced', () => {
  for (const bad of [null, undefined, '', 'yesterday']) assert.equal(isFresh(bad), false)
})

// A stand-in for the one query claimNotification makes.
function fakeAdmin(result, seen = {}) {
  const q = {
    update(patch) { seen.patch = patch; return q },
    eq(col, val) { seen.eq = [col, val]; return q },
    is(col, val) { seen.is = [col, val]; return q },
    select() { return Promise.resolve(result) },
  }
  return { from(table) { seen.table = table; return q } }
}

test('claimNotification: stamps a row that has not been announced', async () => {
  const seen = {}
  const out = await claimNotification(fakeAdmin({ data: [{ id: ID }], error: null }, seen), 'messages', ID)
  assert.equal(out, 'claimed')
  assert.equal(seen.table, 'messages')
  assert.deepEqual(seen.eq, ['id', ID])
  assert.deepEqual(seen.is, ['notified_at', null])
  assert.ok(Date.parse(seen.patch.notified_at) > 0)
})

test('claimNotification: a row already stamped is left alone', async () => {
  assert.equal(await claimNotification(fakeAdmin({ data: [], error: null }), 'message_replies', ID), 'already')
})

test('claimNotification: before Section 39 there is no column, so it says so', async () => {
  for (const error of [
    { code: '42703', message: 'column message_replies.notified_at does not exist' },
    { code: 'PGRST204', message: "Could not find the 'notified_at' column of 'messages' in the schema cache" },
  ]) {
    assert.equal(await claimNotification(fakeAdmin({ data: null, error }), 'messages', ID), 'unstamped')
  }
})

test('claimNotification: any other failure sends nothing', async () => {
  const error = { code: '57014', message: 'canceling statement due to statement timeout' }
  assert.equal(await claimNotification(fakeAdmin({ data: null, error }), 'messages', ID), 'error')
})

test('signedInUser: no token, a bad token and a good one', async () => {
  const admin = {
    auth: {
      getUser: async token => token === 'good'
        ? { data: { user: { id: 'u1', email: 'a@example.com' } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } },
    },
  }
  const req = auth => new Request('http://localhost/x', { method: 'POST', headers: auth ? { authorization: auth } : {} })
  assert.equal(await signedInUser(admin, req()), null)
  assert.equal(await signedInUser(admin, req('Bearer nope')), null)
  assert.deepEqual(await signedInUser(admin, req('Bearer good')), { id: 'u1', email: 'a@example.com' })
})

test('a new conversation is announced with its own subject and text', () => {
  assert.deepEqual(
    enquiryNoticeFromMessage({ subject: 'Leaking tap', message: 'Can you come Friday?' }),
    { subject: 'Leaking tap', message: 'Can you come Friday?' },
  )
  const long = enquiryNoticeFromMessage({ subject: 's'.repeat(500), message: 'm'.repeat(9000) })
  assert.equal(long.subject.length, 200)
  assert.equal(long.message.length, 5000)
})

test('a reply is announced as "Re: subject", a photo as "Photo"', () => {
  const thread = { subject: 'Leaking tap' }
  assert.deepEqual(enquiryNoticeFromReply({ body: 'Friday works' }, thread), { subject: 'Re: Leaking tap', message: 'Friday works' })
  assert.deepEqual(enquiryNoticeFromReply({ body: '', image_url: 'x.jpg' }, thread), { subject: 'Re: Leaking tap', message: 'Photo' })
  assert.equal(enquiryNoticeFromReply({ body: 'Hi' }, { subject: null }).subject, 'Re: your conversation')
})

test('the thread label on a repeat enquiry is not part of the notification', () => {
  const thread = { subject: 'Service enquiry: 1 service' }
  assert.equal(enquiryNoticeFromReply({ body: '--- New service enquiry ---\n\nHi, I am interested in:\n\n• Tap repair: Bds$40' }, thread).message,
    'Hi, I am interested in:\n\n• Tap repair: Bds$40')
  assert.equal(enquiryNoticeFromReply({ body: '--- New message ---\n\nAre you free in December?' }, thread).message,
    'Are you free in December?')
})

test('replyNoticeKind reads the kind from the saved reply', () => {
  assert.equal(replyNoticeKind({ body: 'See you Friday' }), 'reply')
  assert.equal(replyNoticeKind({ body: '', image_url: 'x.jpg' }), 'reply')
  assert.equal(replyNoticeKind({ quote_id: ID, body: 'Sent quote QT-20261112-123' }), 'quote')
  assert.equal(replyNoticeKind({ quote_id: ID, body: invoiceReplyBody('INV-20261112-123', '2026-11-26', 'net_14') }), 'invoice')
  assert.equal(replyNoticeKind({ quote_id: ID, body: 'Sent receipt for INV-20261112-123 - paid in full on 20 Nov 2026. Total $225.00.' }), 'receipt')
  assert.equal(replyNoticeKind({ body: 'Friendly reminder: invoice INV-20261112-123 for $225.00 is due today (due 12 Nov 2026).' }), 'reminder')
})

test('an ordinary reply is never announced as a payment reminder or an invoice', () => {
  assert.equal(replyNoticeKind({ body: 'Friendly reminder: bring your licence on Friday.' }), 'reply')
  // Without a quote attached, "Sent invoice ..." is only words.
  assert.equal(replyNoticeKind({ body: 'Sent invoice INV-1, payment due tomorrow' }), 'reply')
})
