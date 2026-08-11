'use client'
import { useState } from 'react'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

// Peer referral: any visitor can share Vetted.bb with a friend. The link
// points at the homepage so the friend gets the full pitch, then signs up
// normally. No accounts are created here — this is just sharing.
const SHARE_URL = SITE_URL
const SHARE_MSG = "I'm on Vetted.bb, Barbados's marketplace for trusted, reviewed professionals. Join me:"

export default function InvitePage() {
  const [copied, setCopied] = useState(false)

  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${SHARE_MSG} ${SHARE_URL}`)}`
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_MSG)}&url=${encodeURIComponent(SHARE_URL)}`

  function copy() {
    navigator.clipboard.writeText(SHARE_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  async function nativeShare() {
    try {
      if (navigator.share) await navigator.share({ title: 'Vetted.bb', text: SHARE_MSG, url: SHARE_URL })
      else copy()
    } catch { /* user cancelled */ }
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10">

        {/* Hero */}
        <div className="rounded-2xl px-6 sm:px-10 py-10 text-center" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }}>
          <p className="text-4xl mb-3" aria-hidden="true">💌</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Invite friends to Vetted.bb</h1>
          <p className="text-sm sm:text-base max-w-md mx-auto" style={{ color: '#93b8ff' }}>
            Know someone in Barbados who needs a trusted pro, or a skilled pro who should be listed? Send them your invite link.
          </p>
        </div>

        {/* Share card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 mt-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your invite link</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0 flex items-center rounded-xl border border-gray-200 px-4 py-3 bg-gray-50">
              <span className="text-sm text-gray-700 truncate">{SITE_HOST}</span>
            </div>
            <button
              onClick={copy}
              className="flex-shrink-0 text-sm font-semibold px-5 py-3 rounded-xl text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or share directly</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#25D366' }}>
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.335.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411" /></svg>
              WhatsApp
            </a>
            <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#1877F2' }}>
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073" /></svg>
              Facebook
            </a>
            <a href={xUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#0F1419' }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              X
            </a>
            <button onClick={nativeShare} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F' }}>
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
              More…
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-5 leading-relaxed">
            Your friend just opens the link and signs up, either as a client to hire pros or as a freelancer to get listed. It&apos;s free.
          </p>
        </div>
      </div>
    </main>
  )
}
