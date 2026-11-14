// The year-end summary as a printable page, branded like quotes and invoices
// (lib/documentHtml.js), for the server PDF renderer (lib/renderPdf.js).
// It is only ever given figures the SERVER worked out from the database
// (app/api/documents/pdf), never figures sent by a browser, so a Vetted.bb
// branded summary always matches the records behind it.
import { escapeHtml as esc } from './escapeHtml.js'
import { DISCLAIMER, summaryLabels, otherCurrencyNote } from './incomeSummary.js'

const money = n => `Bds$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function buildReportHtml(summary, { name = '', generatedOn = '' } = {}) {
  const l = summaryLabels(summary.side)
  const pro = summary.side === 'professional'
  const row = (label, value, strong = false) => `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;color:${strong ? '#111827' : '#374151'};font-size:13px;${strong ? 'font-weight:700' : ''}">${esc(label)}</td>
        <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:${strong ? '15px' : '13px'};${strong ? 'font-weight:700;color:#00267F' : 'color:#111827'}">${esc(value)}</td>
      </tr>`
  const monthRows = summary.months.map((m, i) => `
      <tr style="background:${i % 2 ? '#f9fafb' : '#ffffff'}">
        <td style="padding:6px 10px;font-size:12px;color:#374151">${esc(m.month)}</td>
        <td style="padding:6px 10px;font-size:12px;text-align:right;color:#374151">${money(m.invoiced)}</td>
        <td style="padding:6px 10px;font-size:12px;text-align:right;color:#111827;font-weight:600">${money(m.received)}</td>
        ${pro ? `<td style="padding:6px 10px;font-size:12px;text-align:right;color:#374151">${money(m.expenses)}</td>` : ''}
      </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(`${summary.year} ${pro ? 'income' : 'spending'} summary - ${name}`)}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:'Barlow',Helvetica,Arial,sans-serif; background:white; color:#111827; font-size:13px; line-height:1.45; }
  table { border-collapse:collapse; width:100%; }
  @page { margin:1.2cm; }
  @media screen { body { padding:40px; } }
  tr { break-inside:avoid; page-break-inside:avoid; }
</style>
</head>
<body>
  <table style="margin-bottom:18px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-family:'Barlow Semi Condensed',sans-serif;font-size:22px;font-weight:700;color:#00267F">Vetted<span style="color:#F9C000">.bb</span></div>
        <div style="font-size:13px;color:#374151;margin-top:6px;font-weight:600">${esc(name)}</div>
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-family:'Barlow Semi Condensed',sans-serif;font-size:26px;font-weight:700;color:#00267F;letter-spacing:2px">${esc(`${summary.year} ${l.title}`)}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px">1 January to 31 December ${esc(summary.year)}${generatedOn ? ` · generated ${esc(generatedOn)}` : ''}</div>
      </td>
    </tr>
  </table>
  <div style="height:3px;background:#F9C000;border-radius:2px;margin-bottom:18px"></div>

  <div style="background:#EEF2FF;border-radius:10px;padding:14px 16px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.08em">${esc(l.headline)} (cash basis)</div>
    <div style="font-family:'Barlow Semi Condensed',sans-serif;font-size:30px;font-weight:700;color:#00267F;margin-top:2px">${money(summary.received)}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(l.headlineNote)}</div>
  </div>

  <table style="margin-bottom:18px">
    ${row(l.invoiced, money(summary.invoiced))}
    ${row(`${l.headline} (cash basis)`, money(summary.received), true)}
    ${row(l.outstanding, money(summary.outstanding))}
    ${pro ? row('Expenses logged', money(summary.expenses)) : ''}
    ${pro ? row('Net (received minus expenses)', money(summary.net), true) : ''}
    ${row('Invoices issued', String(summary.invoiceCount))}
    ${row(l.parties, String(summary.parties))}
    ${row('Average invoice', money(summary.average))}
  </table>

  <table style="margin-bottom:18px">
    <thead>
      <tr style="background:#00267F">
        <th style="padding:7px 10px;text-align:left;color:white;font-size:11px;font-weight:600">Month</th>
        <th style="padding:7px 10px;text-align:right;color:white;font-size:11px;font-weight:600">Invoiced</th>
        <th style="padding:7px 10px;text-align:right;color:white;font-size:11px;font-weight:600">${esc(l.received)}</th>
        ${pro ? '<th style="padding:7px 10px;text-align:right;color:white;font-size:11px;font-weight:600">Expenses</th>' : ''}
      </tr>
    </thead>
    <tbody>${monthRows}</tbody>
  </table>

  ${otherCurrencyNote(summary) ? `<p style="font-size:11px;color:#6b7280;line-height:1.5;margin-bottom:8px">${esc(otherCurrencyNote(summary))}</p>` : ''}
  <p style="font-size:10px;color:#9ca3af;line-height:1.5">${esc(DISCLAIMER)}</p>
</body>
</html>`
}
