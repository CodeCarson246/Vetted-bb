import { escapeHtml } from './escapeHtml.js'
import { formatParish } from './formatParish.js'
import { formatDocDate, addDaysToDateOnly } from './formatDate.js'
import { currencySymbol } from './currency.js'
import { formatVerifyCode } from './verifyCode.js'
import { SITE_HOST } from './siteUrl.js'

// The one template behind every quote, invoice and receipt. Pure: takes a
// quotes row plus the issuing freelancer and returns HTML, so it can be
// unit-tested without a browser. lib/printQuote.js opens the result in a
// tab and prints it.

// Printed documents use the long-month form; the date-only/timezone
// normalisation lives in the shared formatDocDate helper.
const docDateFmt = value => formatDocDate(value, { day: 'numeric', month: 'long', year: 'numeric' })

// How long a quoted price stands when the builder did not say.
export const DEFAULT_VALID_DAYS = 30

const FREE = '<span style="color:#22C55E;font-weight:600">Free</span>'

// Every inline px size becomes calc(Npx * var(--s)), so the print fit can
// shrink type and spacing together by setting one variable. This is plain
// layout, which iPhone Safari honours when printing; CSS zoom (tried first)
// works in desktop Chrome but Safari ignores it on the printed page. Only
// style attributes are touched, and user text is escaped before it gets
// here, so it can never be rewritten.
function scaleInlineSizes(html) {
  return html.replace(/style="([^"]*)"/g, (m, css) =>
    `style="${css.replace(/(-?\d*\.?\d+)px/g, (_, n) => `calc(${n}px * var(--s))`)}"`)
}

/**
 * @param {object} quote   Row from the quotes table.
 * @param {object} issuer  Freelancer info: name, company_name, trade,
 *                         location, email, avatar_url, payment_details.
 * @param {object} [opts]  { type: 'quote' | 'invoice' | 'receipt' } —
 *                         invoice mode uses the invoice number, issue date
 *                         and due date set when the invoice was sent.
 *                         Receipt mode is a paid invoice: a PAID stamp,
 *                         the payment date, and a "paid in full" panel.
 */
export function buildDocumentHtml(quote, issuer, opts = {}) {
  const isReceipt = opts.type === 'receipt'
  const isInvoice = opts.type === 'invoice' || isReceipt
  const docTitle = isReceipt ? 'RECEIPT' : isInvoice ? 'INVOICE' : 'QUOTE'
  const docNumber = isInvoice ? (quote.invoice_number || quote.quote_number) : quote.quote_number
  const docDate = isInvoice ? (quote.invoiced_at || quote.quote_date) : quote.quote_date
  const dueDate = isInvoice ? (quote.invoice_due_date || quote.due_date) : quote.due_date
  const paidDate = quote.paid_at
  // A quote states how long its price stands; invoices carry a due date only.
  const validUntil = isInvoice ? null : (quote.valid_until || addDaysToDateOnly(quote.quote_date, DEFAULT_VALID_DAYS))

  const esc = escapeHtml
  const total = Number(quote.total).toFixed(2)
  // Money is printed as Bds$ (or whatever the quote was issued in), matching
  // the format government and businesses here expect on a document.
  const sym = currencySymbol(quote.currency)
  const companyName = issuer?.company_name?.trim().length > 3 ? issuer.company_name : null
  const addressLines = (block) => (block || '').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => `<div style="font-size:12px;color:#6b7280;margin-bottom:1px">${esc(l)}</div>`).join('')
  const paymentDetails = (issuer?.payment_details || '').trim()
  const notes = (quote.notes || '').trim()
  const terms = (quote.terms || '').trim()
  const clientPhone = (quote.client_phone || '').trim()
  // The business address already ends with the parish, so the separate
  // parish line only shows when there is no address. The freelancer's phone
  // shows only once it has been verified.
  const parish = formatParish(issuer?.location) || ''
  const phone = issuer?.phone_verified ? (issuer?.phone || '').trim() : ''

  const itemRows = (quote.items || []).map((item, i) => {
    const price = parseFloat(item.price) || 0
    const qty = parseInt(item.qty) || 1
    const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
    // A zero or missing price is a deliberate "Free", not missing data.
    const unit = price > 0 ? sym + price.toFixed(2) : FREE
    const line = price > 0 ? sym + (price * qty).toFixed(2) : FREE
    return `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;background:${bg}">${esc(item.description) || ''}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;background:${bg}">${esc(item.qty)}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;background:${bg}">${unit}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;background:${bg}">${line}</td>
    </tr>`
  }).join('')

  // Squircle, like every other avatar in the app.
  const avatarHtml = issuer?.avatar_url
    ? `<img src="${esc(issuer.avatar_url)}" style="width:56px;height:56px;border-radius:14px;object-fit:cover;display:block"/>`
    : `<div style="width:56px;height:56px;border-radius:14px;background:#00267F;color:white;font-size:18px;font-weight:700;text-align:center;line-height:56px;display:block">${esc((issuer?.name || '?').split(' ').map(n => n[0]).join(''))}</div>`

  // Optional text blocks, rendered only when there is something to say.
  // They share one top rule rather than each drawing its own, which keeps a
  // filled document on one page; each block avoids splitting, but the group
  // may break between blocks when a document really is long.
  const block = (label, text, style) => `
      <div class="keep" style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">${label}</div>
        <div style="${style};white-space:pre-line">${esc(text)}</div>
      </div>`

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${isReceipt ? 'Receipt' : isInvoice ? 'Invoice' : 'Quote'}-${esc(docNumber)}-${esc(quote.client_name || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:white; color:#111827; position:relative; font-size:calc(13px * var(--s)); line-height:1.45; }
  .sora { font-family:'Sora','Inter',sans-serif; }
  table { border-collapse:collapse; }
  :root { --s: 1; }
  /* No body padding in print: the page margin is the only margin (padding on
     top of it pushed a short document's footer onto page 2). No page size
     either: the printer's paper wins, and in Barbados that is often US
     Letter, which is 18mm shorter than A4. iPhone Safari also ignores
     @page margin and uses its own 0.75in, so the smallest page a document
     can land on is ~650 CSS px wide (A4) by ~912 tall (Letter). --fit is
     set by the script below to shrink a document that only just overflows
     that page, by scaling every size through --s, so it prints on one
     sheet. The on-screen preview always stays at full size. */
  @page { margin:1.2cm; }
  @media screen { body { padding:40px; } }
  @media print { body { padding:0; } :root { --s: var(--fit, 1); } }
  /* Long documents paginate between rows and between blocks, never
     through them, and the table header repeats on each page. */
  .keep { break-inside:avoid; page-break-inside:avoid; }
  thead { display:table-header-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  .smallprint > .keep:last-child { margin-bottom:0 !important; }
</style>
</head>
<body>
  ${isReceipt ? `<div style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-22deg);border:7px solid #16a34a;color:#16a34a;padding:14px 44px;border-radius:16px;text-align:center;line-height:1;opacity:0.22;pointer-events:none;z-index:0">
    <div style="font-size:84px;font-weight:800;letter-spacing:10px">PAID</div>
    <div style="font-size:20px;font-weight:600;letter-spacing:3px;margin-top:10px">${docDateFmt(paidDate)}</div>
  </div>` : ''}
  <table width="100%" class="keep" style="margin-bottom:18px">
    <tr>
      <td style="vertical-align:top;width:50%">
        <table>
          <tr>
            <td style="vertical-align:top;padding-right:14px">${avatarHtml}</td>
            <td style="vertical-align:top">
              <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:2px">${esc(companyName || issuer?.name || '')}</div>
              ${companyName ? `<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${esc(issuer?.name)}</div>` : ''}
              <div style="font-size:13px;color:#6b7280;margin-bottom:1px">${esc(issuer?.trade || '')}</div>
              ${quote.from_address
                ? `<div style="margin-top:4px;margin-bottom:4px">${addressLines(quote.from_address)}</div>`
                : (parish ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:1px">${esc(parish)}</div>` : '')}
              ${phone ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:1px">${esc(phone)}</div>` : ''}
              ${issuer?.email ? `<div style="font-size:12px;color:#9ca3af">${esc(issuer.email)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:top;text-align:right;width:50%">
        <div class="sora" style="font-size:34px;font-weight:800;color:#00267F;letter-spacing:4px;line-height:1">${docTitle}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:6px">${esc(docNumber)}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:2px">${docDateFmt(docDate)}</div>
        ${validUntil ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px">Valid until ${docDateFmt(validUntil)}</div>` : ''}
        ${isInvoice ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">Ref. quote ${esc(quote.quote_number)}</div>` : ''}
        ${quote.reference ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">Your ref. ${esc(quote.reference)}</div>` : ''}
        ${isReceipt ? `<div style="display:inline-block;margin-top:10px;background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;letter-spacing:0.05em;padding:5px 12px;border-radius:100px">PAID IN FULL${paidDate ? ` &middot; ${docDateFmt(paidDate)}` : ''}</div>` : ''}
      </td>
    </tr>
  </table>
  <table width="100%" style="margin-bottom:16px"><tr><td style="background:#F9C000;height:3px;border-radius:2px;font-size:0">&nbsp;</td></tr></table>
  <div class="keep" style="margin-bottom:16px">
    <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Billed to</div>
    <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:3px">${esc(quote.client_name || 'Client')}</div>
    ${quote.bill_to_division ? `<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:2px">${esc(quote.bill_to_division)}</div>` : ''}
    <div style="font-size:13px;color:#6b7280">${esc(quote.client_email || '')}</div>
    ${clientPhone ? `<div style="font-size:13px;color:#6b7280">${esc(clientPhone)}</div>` : ''}
    ${quote.bill_to_address ? `<div style="margin-top:4px">${addressLines(quote.bill_to_address)}</div>` : ''}
    ${quote.client_address ? `<div style="margin-top:4px">${addressLines(quote.client_address)}</div>` : ''}
  </div>
  <table width="100%" style="border-collapse:collapse;margin-bottom:12px">
    <thead>
      <tr style="background:#00267F">
        <th style="padding:10px 14px;text-align:left;color:white;font-size:12px;font-weight:600">Description</th>
        <th style="padding:10px 14px;text-align:center;color:white;font-size:12px;font-weight:600;width:60px">Qty</th>
        <th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Unit price</th>
        <th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table width="100%" class="keep" style="margin-bottom:14px">
    <tr>
      <td width="60%"></td>
      <td width="40%">
        <table width="100%">
          <tr>
            <td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#111827">Total</td>
            <td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#00267F;text-align:right">${sym}${total}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" class="keep" style="margin-bottom:12px">
    <tr>
      <td style="background:${isReceipt ? '#DCFCE7' : '#EEF2FF'};border-radius:10px;padding:16px 18px">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">${isReceipt ? 'Paid in full' : 'Payment due'}</div>
        <div style="font-size:16px;font-weight:700;color:${isReceipt ? '#166534' : '#00267F'};margin-bottom:3px">${isReceipt ? (paidDate ? `Received ${docDateFmt(paidDate)}` : 'Received') : docDateFmt(dueDate)}</div>
        ${isReceipt ? `<div style="font-size:12px;color:#15803d">Thank you. This payment has been received in full.</div>` : ''}
      </td>
    </tr>
  </table>
  ${[
    paymentDetails && !isReceipt ? block('Payment details', paymentDetails, 'font-size:13px;color:#374151;line-height:1.6') : '',
    notes ? block('Notes', notes, 'font-size:13px;color:#374151;line-height:1.6') : '',
    terms ? block('Terms', terms, 'font-size:0.75rem;color:#6b7280;line-height:1.55') : '',
  ].filter(Boolean).join('') ? `
  <table width="100%" style="margin-bottom:10px">
    <tr><td class="smallprint" style="border-top:1px solid #e5e7eb;padding-top:12px">${[
      paymentDetails && !isReceipt ? block('Payment details', paymentDetails, 'font-size:13px;color:#374151;line-height:1.6') : '',
      notes ? block('Notes', notes, 'font-size:13px;color:#374151;line-height:1.6') : '',
      terms ? block('Terms', terms, 'font-size:0.75rem;color:#6b7280;line-height:1.55') : '',
    ].filter(Boolean).join('')}</td></tr>
  </table>` : ''}
  <table width="100%" class="keep">
    <tr><td style="border-top:1px solid #e5e7eb;padding-top:12px;text-align:center">
      ${quote.verify_code ? `
      <table width="100%" style="margin-bottom:10px"><tr>
        <td style="background:#EEF2FF;border-radius:10px;padding:12px 16px;text-align:left">
          <table width="100%"><tr>
            <td style="vertical-align:middle">
              <div style="font-size:10px;font-weight:700;color:#00267F;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Verify this document</div>
              <div style="font-size:11px;color:#374151">Enter the code at <span style="color:#00267F;font-weight:600">${esc(SITE_HOST)}/verify</span> to confirm it is genuine and see whether it has been accepted, invoiced or paid.</div>
            </td>
            <td style="vertical-align:middle;text-align:right;padding-left:16px;white-space:nowrap">
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:700;color:#111827;letter-spacing:2px">${esc(formatVerifyCode(quote.verify_code))}</div>
            </td>
          </tr></table>
        </td>
      </tr></table>` : ''}
      <div style="font-size:11px;color:#9ca3af">Issued through <span style="color:#00267F;font-weight:600">Vetted<span style="color:#F9C000">.</span>bb</span> &middot; Connecting Barbados</div>
    </td></tr>
  </table>
  <script>
    (function () {
      // Shrink-to-fit: measure the document at the smallest page it can be
      // printed on (narrowest width, shortest height). If it overflows by a
      // little, scale every size down for print (--s) until it lands on one
      // sheet; if even 85% will not fit, leave it at full size and let it
      // paginate. Smaller text also wraps less, so a few passes settle it.
      function fit () {
        var W = 650, H = 912, MIN = 0.85, SAFETY = 0.98
        var root = document.documentElement, b = document.body, st = b.style, pw = st.width, pp = st.padding
        st.padding = '0'; st.width = W + 'px'
        function heightAt (v) { root.style.setProperty('--s', String(v)); return b.scrollHeight }
        var s = 1, h = heightAt(1)
        // Start at 98% of the page, not 100%: a phone can render text a hair
        // taller when printing than when measured, and a document that only
        // just fits is the one most likely to tip onto a second sheet.
        if (h > H * SAFETY) {
          for (var i = 0; i < 4 && h > H * SAFETY && s > MIN; i++) {
            s = Math.max(MIN, s * (H * SAFETY) / h)
            h = heightAt(s)
          }
        }
        root.style.removeProperty('--s')
        st.width = pw; st.padding = pp
        if (s < 1 && h <= H) root.style.setProperty('--fit', s.toFixed(3))
      }
      var done = false
      function go () { if (done) return; done = true; try { fit() } catch (e) {} setTimeout(function () { window.print() }, 150) }
      window.addEventListener('load', function () {
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go)
        setTimeout(go, 1500)
      })
    })()
  </script>
</body>
</html>`
  return scaleInlineSizes(html)
}
