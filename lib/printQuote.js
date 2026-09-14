'use client'
import { buildDocumentHtml } from './documentHtml'
import { supabase } from './supabase'

/**
 * Open a quote, invoice or receipt as a PDF. One entry point shared by the
 * inbox, client messages, jobs, organisation requests and the quotes
 * dashboard.
 *
 * The PDF is rendered on the server (app/api/documents/pdf) so it prints on
 * one page everywhere; phones do not print web pages reliably. If the PDF
 * cannot be made (offline, signed out, server error) the document falls back
 * to the browser's own print of the HTML version, so printing never breaks.
 *
 * @param {object} quote   Row from the quotes table, or an unsaved draft
 *                         (no id) from the quote builder's Preview.
 * @param {object} issuer  Freelancer info, used only by the HTML fallback;
 *                         the server always reads the issuer itself.
 * @param {object} [opts]  { type: 'quote' | 'invoice' | 'receipt' }
 */
export function printSavedQuote(quote, issuer, opts = {}) {
  // Open the tab now, inside the click, or popup blockers stop it once the
  // PDF request has made this asynchronous.
  const win = window.open('', '_blank')
  if (win) {
    try {
      win.document.write('<!doctype html><title>Preparing your document…</title><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#00267F">Preparing your document…</body>')
    } catch { /* the message is cosmetic */ }
  }

  fetchPdf(quote, opts)
    .then(blob => {
      const url = URL.createObjectURL(blob)
      if (win && !win.closed) {
        win.location.href = url
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `${opts.type === 'receipt' ? 'Receipt' : opts.type === 'invoice' ? 'Invoice' : 'Quote'}-${quote.invoice_number || quote.quote_number || 'document'}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
    })
    .catch(() => printHtml(quote, issuer, opts, win))
}

async function fetchPdf(quote, opts) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('signed out')
  const res = await fetch('/api/documents/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(quote?.id ? { quoteId: quote.id, type: opts.type || 'quote' } : { draft: quote, type: 'quote' }),
  })
  if (!res.ok) throw new Error(`pdf ${res.status}`)
  return res.blob()
}

// The previous behaviour: the HTML document prints itself in a tab.
function printHtml(quote, issuer, opts, win) {
  const html = buildDocumentHtml(quote, issuer, opts)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const target = win && !win.closed ? win : window.open(url, '_blank')
  if (target) {
    if (target === win) target.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  URL.revokeObjectURL(url)

  // Popup blocked: print from a hidden iframe instead.
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
