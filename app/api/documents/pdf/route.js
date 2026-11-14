import { createClient } from '@supabase/supabase-js'
import { buildDocumentHtml } from '@/lib/documentHtml'
import { invoicesOf } from '@/lib/payments'
import { incomeSummary } from '@/lib/incomeSummary'
import { buildReportHtml } from '@/lib/reportHtml'
import { renderDocumentPdf } from '@/lib/renderPdf'
import { rateLimit } from '@/lib/rateLimit'

// Quote / invoice / receipt as a real PDF, rendered in headless Chromium so
// it prints on one page on every device (see lib/renderPdf.js).
//
// POST, Authorization: Bearer <session token>, body either
//   { quoteId, type }  a saved document. Read with the caller's own session,
//                      so the quotes RLS policy decides who may print it
//                      (the freelancer, the client's email, org members).
//   { draft, type }    an unsaved quote from the builder's Preview. Only a
//                      freelancer can render one, always as themselves.
// The issuing freelancer's details are always read from the database, never
// taken from the request.
export const runtime = 'nodejs'
export const maxDuration = 60

const TYPES = ['quote', 'invoice', 'receipt']
const ISSUER_COLS = 'id, user_id, name, company_name, trade, location, email, avatar_url, phone, phone_verified, payment_details'

const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : v == null ? null : String(v).slice(0, max))

// Only the fields the template reads, trimmed to sane lengths.
function cleanDraft(d) {
  const items = Array.isArray(d?.items) ? d.items.slice(0, 100).map(i => ({
    description: str(i?.description, 1000) || '',
    qty: str(i?.qty, 12) || '1',
    price: str(i?.price, 20) || '',
  })) : []
  return {
    quote_number: str(d?.quote_number, 40), quote_date: str(d?.quote_date, 10), due_date: str(d?.due_date, 10),
    valid_until: str(d?.valid_until, 10), payment_terms: str(d?.payment_terms, 20),
    client_name: str(d?.client_name, 200), client_email: str(d?.client_email, 200),
    client_phone: str(d?.client_phone, 40), client_address: str(d?.client_address, 500),
    items, total: Number(d?.total) || 0, notes: str(d?.notes, 2000), terms: str(d?.terms, 2000),
    currency: str(d?.currency, 3) || 'BBD', reference: str(d?.reference, 100),
    from_address: str(d?.from_address, 500), bill_to_division: str(d?.bill_to_division, 200),
    bill_to_address: str(d?.bill_to_address, 500), verify_code: str(d?.verify_code, 12),
    // A deposit on an unsaved quote, for the builder's Preview. Only the two
    // known kinds pass; anything else is no deposit.
    ...(['percent', 'fixed'].includes(d?.deposit_type) && Number(d?.deposit_value) > 0
      ? { deposit_type: d.deposit_type, deposit_value: Number(d.deposit_value) } : {}),
  }
}

// The professional a document is from. Their email, phone and payment
// details are printed on it but are not public columns (SQL Section 41), so
// this read uses the service role, and only ever after the caller has been
// shown to be entitled: they can read the quote, or the row is their own.
// Without the service key (local development against a database that has
// not had Section 41 run) the caller's session is used, as before.
async function readIssuer(db, column, value) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const client = serviceKey ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey) : db
  const { data } = await client.from('freelancers').select(ISSUER_COLS).eq(column, value).maybeSingle()
  return data || null
}

// Rows of a table that may not exist yet (a section of SQL not run): none.
async function rowsOrNone(query) {
  const { data, error } = await query
  return error ? [] : (data || [])
}

async function yearEndReport(db, user, { year, side, organisationId } = {}) {
  const thisYear = new Date().getUTCFullYear()
  const y = Number(year)
  if (!Number.isInteger(y) || y < 2020 || y > thisYear + 1) return Response.json({ error: 'Choose a year.' }, { status: 400 })

  let quotes, expenses = [], name
  if (side === 'organisation') {
    // Only an organisation the caller belongs to.
    const { data: member } = organisationId
      ? await db.from('organisation_members').select('organisation_id').eq('organisation_id', organisationId).eq('user_id', user.id).maybeSingle()
      : { data: null }
    if (!member) return Response.json({ error: 'Forbidden' }, { status: 403 })
    const { data: org } = await db.from('organisations').select('name').eq('id', organisationId).maybeSingle()
    name = org?.name || 'Your organisation'
    quotes = await rowsOrNone(db.from('quotes').select('*').eq('organisation_id', organisationId))
  } else {
    const { data: f } = await db.from('freelancers').select('id, name, company_name').eq('user_id', user.id).maybeSingle()
    if (!f) return Response.json({ error: 'Forbidden' }, { status: 403 })
    name = (f.company_name || '').trim().length > 3 ? f.company_name : f.name
    quotes = await rowsOrNone(db.from('quotes').select('*').eq('freelancer_id', f.id))
    expenses = await rowsOrNone(db.from('job_expenses').select('amount, incurred_on').eq('freelancer_id', f.id))
  }
  const invoiced = quotes.filter(q => q.invoice_number).map(q => q.id)
  const payments = invoiced.length ? await rowsOrNone(db.from('invoice_payments').select('quote_id, amount, received_on').in('quote_id', invoiced)) : []

  const summary = incomeSummary({ quotes, payments, expenses }, y, side === 'organisation' ? 'organisation' : 'professional')
  const generatedOn = new Date(Date.now() - 4 * 3600 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const { pdf } = await renderDocumentPdf(buildReportHtml(summary, { name, generatedOn }))
  const filename = `Vetted-${summary.side === 'organisation' ? 'spending' : 'income'}-summary-${y}.pdf`
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function POST(request) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // A client bound to the caller's session: every read below is subject to RLS as them.
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: authErr } = await db.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Rendering is heavy: a speed bump against runaway loops.
    if (!(await rateLimit(`pdf:${user.id}`, { limit: 20, windowMs: 60_000 }))) {
      return Response.json({ error: 'Too many documents at once. Try again in a minute.' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))

    // The year-end summary. Worked out HERE from the database, read with the
    // caller's own session, so row level security decides what is counted
    // and the branded PDF always matches the records. Figures sent by the
    // browser are never printed.
    if (body?.report) return await yearEndReport(db, user, body.report)
    let type = TYPES.includes(body?.type) ? body.type : 'quote'

    let quote, issuer
    if (body?.quoteId) {
      const { data } = await db.from('quotes').select('*').eq('id', body.quoteId).maybeSingle()
      if (!data) return Response.json({ error: 'Document not found' }, { status: 404 })
      quote = data
      // The request asks for a kind of document; the saved quote decides
      // whether that document exists. A receipt (the PAID stamp) is only
      // for a job marked paid, and an invoice only once one was issued.
      // Otherwise anyone who can open a quote could print themselves a
      // receipt for money that was never paid.
      if (type === 'receipt' && !quote.paid_at) {
        return Response.json({ error: 'There is no receipt yet: this job has not been marked as paid.' }, { status: 409 })
      }
      if (type === 'invoice' && !quote.invoice_number) {
        return Response.json({ error: 'There is no invoice yet for this quote.' }, { status: 409 })
      }
      // The caller's own session has just proved they may read this quote.
      issuer = await readIssuer(db, 'id', quote.freelancer_id)
    } else if (body?.draft) {
      const f = await readIssuer(db, 'user_id', user.id)
      if (!f) return Response.json({ error: 'Forbidden' }, { status: 403 })
      issuer = f
      quote = cleanDraft(body.draft)
      type = 'quote' // an unsaved draft is only ever a quote
    } else {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    // A deposit job has two invoices; the request may name one of them. A
    // number that is not one of this job's invoices is ignored (the latest
    // invoice is printed), never printed as given.
    const wanted = typeof body?.invoiceNumber === 'string' ? body.invoiceNumber : null
    const invoiceNumber = type === 'invoice' && wanted && invoicesOf(quote).some(i => i.number === wanted) ? wanted : undefined
    const html = buildDocumentHtml(quote, issuer, { type, forPdf: true, invoiceNumber })
    const { pdf, pages, scale } = await renderDocumentPdf(html)

    const label = type === 'receipt' ? 'Receipt' : type === 'invoice' ? 'Invoice' : 'Quote'
    const number = (type === 'quote' ? quote.quote_number : invoiceNumber || quote.balance_invoice_number || quote.invoice_number || quote.quote_number) || 'document'
    const filename = `${label}-${number}`.replace(/[^A-Za-z0-9._-]+/g, '-') + '.pdf'

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Document-Pages': String(pages),
        'X-Document-Scale': scale.toFixed(3),
      },
    })
  } catch (err) {
    console.error('documents/pdf failed', err)
    return Response.json({ error: 'Could not create the PDF.' }, { status: 500 })
  }
}
