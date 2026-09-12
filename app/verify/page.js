'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { normaliseVerifyCode } from '@/lib/verifyCode'

// Landing page for the verification code printed on every Vetted.bb quote,
// invoice and receipt. Type it in, and /verify/<code> shows the record.
export default function VerifyEntry() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const clean = normaliseVerifyCode(code)

  function submit(e) {
    e.preventDefault()
    if (clean.length >= 6) router.push(`/verify/${clean}`)
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className="max-w-xl mx-auto px-4 sm:px-8 py-12">
        <p className="text-xs font-bold uppercase tracking-widest mb-2 text-center" style={{ color: '#00267F' }}>Document verification</p>
        <form onSubmit={submit} className="bg-white rounded-2xl px-6 py-8 sm:px-10 text-center" style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Check a quote, invoice or receipt</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Every document issued through Vetted.bb carries a verification code at the bottom. Enter it to confirm the document is genuine and see whether it has been accepted, invoiced or paid.
          </p>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="ABCDE-FGHJK"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="w-full text-center font-mono text-lg tracking-widest px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white mb-4"
          />
          <button type="submit" disabled={clean.length < 6} className="w-full sm:w-auto text-sm font-semibold px-8 py-3 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
            Verify document
          </button>
          <p className="text-xs text-gray-400 mt-5">Shows who issued it, who it was billed to, the total, and its current status. Nothing else.</p>
        </form>
      </div>
    </main>
  )
}
