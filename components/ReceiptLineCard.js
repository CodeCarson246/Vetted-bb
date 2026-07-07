'use client'
import { parseReceiptLine } from '@/lib/quoteReply'

// Compact, display-only Receipt card for legacy "Sent receipt …" replies whose
// linked quote can't be resolved (so there's no document to download). Keeps
// receipts looking consistent with the full Receipt card instead of falling
// back to a bare chat line. Built purely from the message body — no data fetch.
export default function ReceiptLineCard({ body, fromName }) {
  const info = parseReceiptLine(body)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3" style={{ backgroundColor: '#166534' }}>
        <p className="text-white font-semibold text-sm">Receipt{info?.ref ? ` ${info.ref}` : ''}</p>
        {fromName && <p className="text-xs mt-0.5" style={{ color: '#86efac' }}>From {fromName}</p>}
      </div>
      <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-4">
          {info?.total && (
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-sm font-bold" style={{ color: '#00267F' }}>${info.total}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Paid</p>
            <p className="text-sm font-semibold" style={{ color: '#166534' }}>{info?.paidOn || '-'}</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>Paid ✓</span>
      </div>
    </div>
  )
}
