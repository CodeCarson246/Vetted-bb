import puppeteer from 'puppeteer-core'

// Server-side PDF rendering for quotes, invoices and receipts.
//
// Phones do not print web pages reliably: iPhone Safari ignores print
// margins and CSS scaling, so a document that fits on a PC spilled onto a
// second sheet. Rendering a real PDF here, in headless Chromium, from the
// same HTML template the preview uses, fixes the page once: a PDF page is
// fixed, so every phone, computer and printer prints it the same way.
//
// On Vercel (Linux) Chromium comes from @sparticuz/chromium. Locally, an
// installed Chrome is used: set CHROME_EXECUTABLE_PATH, or the usual Windows
// and macOS locations are tried.

// US Letter, which most printers in Barbados are set to, with the template's
// own 1.2cm margins. Chromium lays out print at 96 CSS px per inch, so the
// content box is known exactly and the fit can be measured, not guessed.
const MARGIN_CM = 1.2
const PX_PER_IN = 96
const MARGIN_PX = (MARGIN_CM / 2.54) * PX_PER_IN
export const CONTENT_W = Math.floor(8.5 * PX_PER_IN - 2 * MARGIN_PX)
export const CONTENT_H = Math.floor(11 * PX_PER_IN - 2 * MARGIN_PX)
// Below this a document is genuinely long: print it full size across pages.
const MIN_SCALE = 0.85

const LOCAL_CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

async function launch() {
  if (process.platform === 'linux') {
    const chromium = (await import('@sparticuz/chromium')).default
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    })
  }
  const { existsSync } = await import('node:fs')
  const executablePath = process.env.CHROME_EXECUTABLE_PATH || LOCAL_CHROME.find(p => existsSync(p))
  if (!executablePath) throw new Error('No local Chrome found. Set CHROME_EXECUTABLE_PATH.')
  return puppeteer.launch({ executablePath, headless: true })
}

// One browser per warm function instance, relaunched if it dies.
let browserPromise = null
function getBrowser() {
  if (!browserPromise) {
    browserPromise = launch()
      .then(browser => {
        browser.on('disconnected', () => { browserPromise = null })
        return browser
      })
      .catch(err => { browserPromise = null; throw err })
  }
  return browserPromise
}

// Page objects are "/Type /Page"; the page tree is "/Type /Pages".
export function countPdfPages(pdf) {
  return (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length
}

/**
 * Render a document's HTML (from buildDocumentHtml with forPdf) to a one-page
 * PDF when it can fit at 85% or more, otherwise a full-size multi-page PDF.
 * Scaling goes through the template's --fit/--s variables, which shrink type
 * and spacing together.
 *
 * @returns {Promise<{ pdf: Uint8Array, pages: number, scale: number }>}
 */
export async function renderDocumentPdf(html) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: CONTENT_W, height: CONTENT_H })
    await page.emulateMediaType('print')
    // Fonts and the avatar load over the network; a slow image must not
    // block the document, so a timeout here is not an error.
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15_000 }).catch(() => {})
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})

    const heightAt = s => page.evaluate(v => {
      document.documentElement.style.setProperty('--fit', String(v))
      return document.body.scrollHeight
    }, s)

    // Smaller text also wraps less, so a few passes settle the scale.
    let scale = 1
    let height = await heightAt(1)
    for (let i = 0; i < 4 && height > CONTENT_H && scale > MIN_SCALE; i++) {
      scale = Math.max(MIN_SCALE, scale * (CONTENT_H * 0.99) / height)
      height = await heightAt(scale)
    }
    const fitsOnePage = height <= CONTENT_H
    if (!fitsOnePage) { scale = 1; await heightAt(1) }

    const print = () => page.pdf({
      format: 'letter',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: `${MARGIN_CM}cm`, right: `${MARGIN_CM}cm`, bottom: `${MARGIN_CM}cm`, left: `${MARGIN_CM}cm` },
    })

    let pdf = await print()
    let pages = countPdfPages(pdf)
    // Measured layout and real pagination can disagree by a line or two:
    // if a document that should fit still spilled, nudge it down and retry.
    for (let i = 0; i < 2 && fitsOnePage && pages > 1 && scale > MIN_SCALE; i++) {
      scale = Math.max(MIN_SCALE, scale * 0.96)
      await heightAt(scale)
      pdf = await print()
      pages = countPdfPages(pdf)
    }
    return { pdf, pages, scale }
  } finally {
    await page.close().catch(() => {})
  }
}
