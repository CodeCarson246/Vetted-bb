'use client'
import { buildDocumentHtml } from './documentHtml'

/**
 * Print/download a saved quote (or its invoice / receipt) as a PDF via
 * the browser print dialog. One implementation shared by the inbox,
 * client messages, and the quotes dashboard. The HTML itself comes from
 * lib/documentHtml.js (pure, unit-tested); this file only opens it.
 *
 * @param {object} quote   Row from the quotes table.
 * @param {object} issuer  Freelancer info: name, company_name, trade,
 *                         location, email, avatar_url, payment_details.
 * @param {object} [opts]  { type: 'quote' | 'invoice' | 'receipt' }
 */
export function printSavedQuote(quote, issuer, opts = {}) {
  const html = buildDocumentHtml(quote, issuer, opts)

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
