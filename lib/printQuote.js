'use client'
import { escapeHtml } from './escapeHtml'
import { formatParish } from './formatParish'
import { formatDocDate } from './formatDate'

// Printed documents use the long-month form; the date-only/timezone
// normalisation lives in the shared formatDocDate helper.
const quoteDate = value => formatDocDate(value, { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Print/download a saved quote (or its invoice) as a PDF via the
 * browser print dialog. One implementation shared by the inbox, client
 * messages, and the quotes dashboard — all user fields HTML-escaped.
 *
 * @param {object} quote   Row from the quotes table.
 * @param {object} issuer  Freelancer info: name, company_name, trade,
 *                         location, email, avatar_url.
 * @param {object} [opts]  { type: 'quote' | 'invoice' | 'receipt' } —
 *                         invoice mode uses the invoice number, issue date
 *                         and due date set when the invoice was sent.
 *                         Receipt mode is a paid invoice: a PAID stamp,
 *                         the payment date, and a "paid in full" panel.
 */
export function printSavedQuote(quote, issuer, opts = {}) {
  const isReceipt = opts.type === 'receipt'
  const isInvoice = opts.type === 'invoice' || isReceipt
  const docTitle = isReceipt ? 'RECEIPT' : isInvoice ? 'INVOICE' : 'QUOTE'
  const docNumber = isInvoice ? (quote.invoice_number || quote.quote_number) : quote.quote_number
  const docDate = isInvoice ? (quote.invoiced_at || quote.quote_date) : quote.quote_date
  const dueDate = isInvoice ? (quote.invoice_due_date || quote.due_date) : quote.due_date
  const paidDate = quote.paid_at

  const esc = escapeHtml
  const total = Number(quote.total).toFixed(2)
  const companyName = issuer?.company_name?.trim().length > 3 ? issuer.company_name : null

  const itemRows = (quote.items || []).map((item, i) => `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">${esc(item.description) || ''}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">${esc(item.qty)}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">${item.price ? '$' + parseFloat(item.price).toFixed(2) : ''}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">${item.price ? '$' + ((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1)).toFixed(2) : ''}</td>
    </tr>`).join('')

  const avatarHtml = issuer?.avatar_url
    ? `<img src="${esc(issuer.avatar_url)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block"/>`
    : `<div style="width:56px;height:56px;border-radius:50%;background:#00267F;color:white;font-size:18px;font-weight:700;text-align:center;line-height:56px;display:block">${esc((issuer?.name || '?').split(' ').map(n => n[0]).join(''))}</div>`

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${isReceipt ? 'Receipt' : isInvoice ? 'Invoice' : 'Quote'}-${esc(docNumber)}-${esc(quote.client_name || '')}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:white; color:#111827; padding:40px; position:relative; }
  @page { margin:1.2cm; size:A4; }
  table { border-collapse:collapse; }
</style>
</head>
<body>
  ${isReceipt ? `<div style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-22deg);border:7px solid #16a34a;color:#16a34a;padding:14px 44px;border-radius:16px;text-align:center;line-height:1;opacity:0.22;pointer-events:none;z-index:0">
    <div style="font-size:84px;font-weight:800;letter-spacing:10px">PAID</div>
    <div style="font-size:20px;font-weight:600;letter-spacing:3px;margin-top:10px">${quoteDate(paidDate)}</div>
  </div>` : ''}
  <table width="100%" style="margin-bottom:28px">
    <tr>
      <td style="vertical-align:top;width:50%">
        <table>
          <tr>
            <td style="vertical-align:top;padding-right:14px">${avatarHtml}</td>
            <td style="vertical-align:top">
              <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:2px">${esc(companyName || issuer?.name || '')}</div>
              ${companyName ? `<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${esc(issuer?.name)}</div>` : ''}
              <div style="font-size:13px;color:#6b7280;margin-bottom:1px">${esc(issuer?.trade || '')}</div>
              <div style="font-size:12px;color:#9ca3af;margin-bottom:1px">${esc(formatParish(issuer?.location) || '')}</div>
              ${issuer?.email ? `<div style="font-size:12px;color:#9ca3af">${esc(issuer.email)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:top;text-align:right;width:50%">
        <div style="font-size:34px;font-weight:800;color:#00267F;letter-spacing:4px;line-height:1">${docTitle}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:6px">${esc(docNumber)}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:2px">${quoteDate(docDate)}</div>
        ${isInvoice ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">Ref. quote ${esc(quote.quote_number)}</div>` : ''}
        ${isReceipt ? `<div style="display:inline-block;margin-top:10px;background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;letter-spacing:0.05em;padding:5px 12px;border-radius:100px">PAID IN FULL${paidDate ? ` &middot; ${quoteDate(paidDate)}` : ''}</div>` : ''}
      </td>
    </tr>
  </table>
  <table width="100%" style="margin-bottom:24px"><tr><td style="background:#F9C000;height:3px;border-radius:2px;font-size:0">&nbsp;</td></tr></table>
  <div style="margin-bottom:24px">
    <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Billed to</div>
    <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:3px">${esc(quote.client_name || 'Client')}</div>
    <div style="font-size:13px;color:#6b7280">${esc(quote.client_email || '')}</div>
  </div>
  <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
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
  <table width="100%" style="margin-bottom:24px">
    <tr>
      <td width="60%"></td>
      <td width="40%">
        <table width="100%">
          <tr>
            <td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Subtotal</td>
            <td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right">$${total}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#111827">Total</td>
            <td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#00267F;text-align:right">$${total}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" style="margin-bottom:24px">
    <tr>
      <td style="background:${isReceipt ? '#DCFCE7' : '#EEF2FF'};border-radius:10px;padding:16px 18px">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">${isReceipt ? 'Paid in full' : 'Payment due'}</div>
        <div style="font-size:16px;font-weight:700;color:${isReceipt ? '#166534' : '#00267F'};margin-bottom:3px">${isReceipt ? (paidDate ? `Received ${quoteDate(paidDate)}` : 'Received') : quoteDate(dueDate)}</div>
        ${isReceipt ? `<div style="font-size:12px;color:#15803d">Thank you. This payment has been received in full.</div>` : ''}
      </td>
    </tr>
  </table>
  ${quote.notes?.trim() ? `
  <table width="100%" style="margin-bottom:24px">
    <tr><td style="border-top:1px solid #e5e7eb;padding-top:16px">
      <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Notes</div>
      <div style="font-size:13px;color:#374151;line-height:1.7">${esc(quote.notes)}</div>
    </td></tr>
  </table>` : ''}
  <table width="100%">
    <tr><td style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center">
      <div style="font-size:11px;color:#9ca3af">Generated via <span style="color:#00267F;font-weight:600">Vetted.bb</span> &middot; Connecting Barbados</div>
    </td></tr>
  </table>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 300) })</script>
</body>
</html>`

  // Open the document in a new tab via a Blob URL and let the document
  // print itself once loaded. document.write into a fresh about:blank
  // races the tab's own navigation (Edge/Chrome can wipe the content,
  // leaving a blank page), and hidden-iframe print() is silently
  // ignored on iOS — the Blob URL approach works everywhere.
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  URL.revokeObjectURL(url)

  // Popup blocked — fall back to the hidden-iframe approach
  const printFrame = document.createElement('iframe')
  printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;'
  document.body.appendChild(printFrame)
  const doc = printFrame.contentDocument || printFrame.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()
  printFrame.contentWindow.focus()
  setTimeout(() => {
    printFrame.contentWindow.print()
    setTimeout(() => document.body.removeChild(printFrame), 1500)
  }, 800)
}
