'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatParish } from '@/lib/formatParish'

function EnvelopeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

export default function ClientMessages() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [replies, setReplies] = useState({})
  const [quotes, setQuotes] = useState({})
  const [viewingQuote, setViewingQuote] = useState(null)
  const [newReplies, setNewReplies] = useState({})
  const [myReviews, setMyReviews] = useState([])
  const [toast, setToast] = useState(null)

  const { user: authUser, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    async function init() {
      const u = authUser
      if (!u) { router.push('/login'); return }
      setUser(u)
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, freelancers(id, name, avatar_url, trade, company_name, email, location)')
        .eq('sender_email', u.email)
        .order('created_at', { ascending: false })
      setMessages(msgs || [])

      const { data: revs } = await supabase
        .from('reviews')
        .select('*, freelancers(id, name)')
        .eq('author', u.id)
        .order('date', { ascending: false })
      setMyReviews(revs || [])

      setLoading(false)
    }
    init()
  }, [authUser, authLoading, router])

  async function handleExpand(msg) {
    if (expandedId === msg.id) { setExpandedId(null); return }
    setExpandedId(msg.id)
    const { data: r } = await supabase
      .from('message_replies')
      .select('*')
      .eq('message_id', msg.id)
      .order('created_at', { ascending: true })
    setReplies(prev => ({ ...prev, [msg.id]: r || [] }))
    const quoteIds = (r || [])
      .filter(rep => rep.body.startsWith('__QUOTE__'))
      .map(rep => rep.body.replace('__QUOTE__', ''))
    if (quoteIds.length > 0) {
      const { data: qs } = await supabase
        .from('quotes')
        .select('*')
        .in('id', quoteIds)
      if (qs) {
        const map = {}
        qs.forEach(q => { map[q.id] = q })
        setQuotes(prev => ({ ...prev, ...map }))
      }
    }
  }

  function hasNewActivity(msg) {
    return (replies[msg.id] || []).length > 0
  }

  async function handleDeleteReview(reviewId) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('author', user.id)
    if (error) {
      setToast({ message: 'Failed to delete review. Please try again.', type: 'error' })
    } else {
      setMyReviews(prev => prev.filter(r => r.id !== reviewId))
      setToast({ message: 'Your review has been removed.', type: 'success' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My messages</h1>
          <span className="text-sm text-gray-500">{messages.length} conversation{messages.length !== 1 ? 's' : ''}</span>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <EnvelopeIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="font-medium text-gray-900 mb-1">No messages yet</p>
            <p className="text-sm text-gray-500 mb-6">Contact a freelancer to start a conversation.</p>
            <a href="/search" className="inline-block px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
              Browse freelancers
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`bg-white rounded-2xl border transition-all ${expandedId === msg.id ? 'border-gray-200 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}
              >
                {/* Message header row */}
                <div
                  className="p-5 sm:p-6 cursor-pointer"
                  onClick={() => handleExpand(msg)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {msg.freelancers?.avatar_url
                        ? <img src={msg.freelancers.avatar_url} alt={msg.freelancers.name} className="w-full h-full object-cover" />
                        : (msg.freelancers?.name || '?').split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{msg.freelancers?.name || 'Freelancer'}</span>
                          <span className="text-xs text-gray-400">{msg.freelancers?.trade}</span>
                          {(replies[msg.id] || []).length > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                              {(replies[msg.id] || []).length} repl{(replies[msg.id] || []).length === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mt-0.5">{msg.subject}</p>
                      {expandedId !== msg.id && (
                        <p className="text-sm text-gray-400 mt-0.5 truncate">{msg.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Expanded thread */}
                  {expandedId === msg.id && (
                    <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col gap-4" onClick={e => e.stopPropagation()}>

                      {/* Original message */}
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#93b8ff' }}>
                          {(user?.user_metadata?.full_name || user?.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                          <p className="text-xs font-semibold text-gray-500 mb-1">You</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-xs text-gray-400 mt-1.5">{new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>

                      {/* Replies */}
                      {(replies[msg.id] || []).map(r => {
                        const isQuote = r.body.startsWith('__QUOTE__')
                        const quoteId = isQuote ? r.body.replace('__QUOTE__', '') : null
                        const quoteData = quoteId ? (quotes[quoteId] || null) : null

                        if (isQuote && quoteData) {
                          return (
                            <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#00267F' }}>
                                <div>
                                  <p className="text-white font-semibold text-sm">Quote {quoteData.quote_number}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#93b8ff' }}>
                                    From {msg.freelancers?.name} · {new Date(quoteData.quote_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setViewingQuote({ quote: quoteData, freelancer: msg.freelancers })}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                                  style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                                >
                                  View & download
                                </button>
                              </div>
                              <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <p className="text-xs text-gray-400">Total</p>
                                    <p className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(quoteData.total).toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">Payment due</p>
                                    <p className="text-sm font-semibold text-gray-700">{new Date(quoteData.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                                  {quoteData.status}
                                </span>
                              </div>
                            </div>
                          )
                        }

                        if (isQuote && !quoteData) return null

                        return (
                          <div key={r.id} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                              {msg.freelancers?.avatar_url
                                ? <img src={msg.freelancers.avatar_url} alt={msg.freelancers.name} className="w-full h-full object-cover" />
                                : (msg.freelancers?.name || '?')[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">{r.sender_name}</p>
                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                              <p className="text-xs text-gray-400 mt-1.5">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        )
                      })}

                      {(replies[msg.id] || []).length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No replies yet. The freelancer will respond here.</p>
                      )}

                      <a
                        href={`/freelancers/${msg.freelancers?.id}`}
                        className="text-xs font-medium hover:opacity-80 transition-opacity text-center mt-1"
                        style={{ color: '#00267F' }}
                      >
                        View {msg.freelancers?.name}&apos;s profile →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My reviews */}
      {myReviews.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-8 pb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-5">My reviews</h2>
          <div className="flex flex-col gap-3">
            {myReviews.map(review => (
              <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{review.freelancers?.name || 'Freelancer'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{review.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className={`text-sm ${star <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {review.service_name && (
                  <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                    {review.service_name}
                  </span>
                )}
                <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Quote viewer modal */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setViewingQuote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto p-8 quote-doc-print" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {viewingQuote.freelancer?.avatar_url ? (
                  <img src={viewingQuote.freelancer.avatar_url} alt={viewingQuote.freelancer.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                    {(viewingQuote.freelancer?.name || '?').split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{viewingQuote.freelancer?.company_name || viewingQuote.freelancer?.name}</p>
                  <p className="text-sm text-gray-500">{viewingQuote.freelancer?.trade}</p>
                  <p className="text-xs text-gray-400">{viewingQuote.freelancer?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: '#00267F' }}>QUOTE</p>
                <p className="text-xs text-gray-400 mt-1">{viewingQuote.quote.quote_number}</p>
                <p className="text-xs text-gray-400">{new Date(viewingQuote.quote.quote_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="h-0.5 mb-6 rounded-full" style={{ backgroundColor: '#F9C000' }} />
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Billed to</p>
              <p className="font-semibold text-gray-900">{viewingQuote.quote.client_name}</p>
              <p className="text-sm text-gray-500">{viewingQuote.quote.client_email}</p>
            </div>
            <table className="w-full mb-6 text-sm">
              <thead>
                <tr style={{ backgroundColor: '#00267F' }}>
                  <th className="text-left px-3 py-2 text-white font-medium rounded-tl-lg text-xs">Description</th>
                  <th className="text-center px-3 py-2 text-white font-medium text-xs w-12">Qty</th>
                  <th className="text-right px-3 py-2 text-white font-medium text-xs w-20">Unit price</th>
                  <th className="text-right px-3 py-2 text-white font-medium rounded-tr-lg text-xs w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewingQuote.quote.items || []).map((item, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                    <td className="px-3 py-2 text-gray-700">{item.description || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{item.qty}</td>
                    <td className="px-3 py-2 text-gray-700 text-right">{item.price ? `$${parseFloat(item.price).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 text-right">
                      {item.price ? `$${((parseFloat(item.price)||0) * (parseInt(item.qty)||1)).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mb-6">
              <div className="w-48">
                <div className="flex justify-between py-2 border-t border-gray-200">
                  <span className="text-sm text-gray-500">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900">${Number(viewingQuote.quote.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-gray-900 mt-1">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(viewingQuote.quote.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#EEF2FF' }}>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">Payment due</p>
              <p className="text-sm font-bold" style={{ color: '#00267F' }}>{new Date(viewingQuote.quote.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            {viewingQuote.quote.notes && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-gray-600 leading-relaxed">{viewingQuote.quote.notes}</p>
              </div>
            )}
            <div className="border-t border-gray-100 pt-4 text-center mb-6">
              <p className="text-xs text-gray-400">Generated via <span className="font-semibold" style={{ color: '#00267F' }}>Vetted.bb</span> · Connecting Barbados</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setViewingQuote(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">
                Close
              </button>
              <button
                onClick={() => {
                  const q = viewingQuote.quote
                  const f = viewingQuote.freelancer
                  const total = Number(q.total).toFixed(2)
                  const itemRows = (q.items||[]).map((item,i)=>`<tr><td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.description||'—'}</td><td style="padding:10px 14px;font-size:13px;text-align:center;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.qty}</td><td style="padding:10px 14px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.price?'$'+parseFloat(item.price).toFixed(2):'—'}</td><td style="padding:10px 14px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.price?'$'+((parseFloat(item.price)||0)*(parseInt(item.qty)||1)).toFixed(2):'—'}</td></tr>`).join('')
                  const avatarHtml = f?.avatar_url?`<img src="${f.avatar_url}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block"/>`:`<div style="width:56px;height:56px;border-radius:50%;background:#00267F;color:white;font-size:18px;font-weight:700;text-align:center;line-height:56px">${(f?.name||'?').split(' ').map(n=>n[0]).join('')}</div>`
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Quote ${q.quote_number}</title><style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:white;color:#111827;padding:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:1.2cm;size:A4;}table{border-collapse:collapse;}</style></head><body><table width="100%" style="margin-bottom:28px"><tr><td style="vertical-align:top;width:50%"><table><tr><td style="vertical-align:top;padding-right:14px">${avatarHtml}</td><td style="vertical-align:top"><div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:2px">${f?.company_name||f?.name||''}</div>${f?.company_name?`<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${f?.name}</div>`:''}<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${f?.trade||''}</div><div style="font-size:12px;color:#9ca3af;margin-bottom:1px">${formatParish(f?.location)||''}</div>${f?.email?`<div style="font-size:12px;color:#9ca3af">${f.email}</div>`:''}</td></tr></table></td><td style="vertical-align:top;text-align:right;width:50%"><div style="font-size:34px;font-weight:800;color:#00267F;letter-spacing:4px;line-height:1">QUOTE</div><div style="font-size:12px;color:#9ca3af;margin-top:6px">${q.quote_number}</div><div style="font-size:12px;color:#9ca3af;margin-top:2px">${new Date(q.quote_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div></td></tr></table><table width="100%" style="margin-bottom:24px"><tr><td style="background:#F9C000;height:3px;font-size:0">&nbsp;</td></tr></table><div style="margin-bottom:24px"><div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Billed to</div><div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:3px">${q.client_name}</div><div style="font-size:13px;color:#6b7280">${q.client_email}</div></div><table width="100%" style="border-collapse:collapse;margin-bottom:20px"><thead><tr style="background:#00267F"><th style="padding:10px 14px;text-align:left;color:white;font-size:12px;font-weight:600">Description</th><th style="padding:10px 14px;text-align:center;color:white;font-size:12px;font-weight:600;width:60px">Qty</th><th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Unit price</th><th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Total</th></tr></thead><tbody>${itemRows}</tbody></table><table width="100%" style="margin-bottom:24px"><tr><td width="60%"></td><td width="40%"><table width="100%"><tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Subtotal</td><td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right">$${total}</td></tr><tr><td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#111827">Total</td><td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#00267F;text-align:right">$${total}</td></tr></table></td></tr></table><table width="100%" style="margin-bottom:24px"><tr><td style="background:#EEF2FF;border-radius:10px;padding:16px 18px"><div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Payment due</div><div style="font-size:16px;font-weight:700;color:#00267F;margin-bottom:3px">${new Date(q.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div></td></tr></table>${q.notes?`<table width="100%" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb;padding-top:16px"><div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Notes</div><div style="font-size:13px;color:#374151;line-height:1.7">${q.notes}</div></td></tr></table>`:''}<table width="100%"><tr><td style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center"><div style="font-size:11px;color:#9ca3af">Generated via <span style="color:#00267F;font-weight:600">Vetted.bb</span> &middot; Connecting Barbados</div></td></tr></table></body></html>`
                  const printFrame = document.createElement('iframe')
                  printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;'
                  document.body.appendChild(printFrame)
                  const doc = printFrame.contentDocument||printFrame.contentWindow.document
                  doc.open();doc.write(html);doc.close()
                  printFrame.contentWindow.focus()
                  setTimeout(()=>{printFrame.contentWindow.print();setTimeout(()=>document.body.removeChild(printFrame),1500)},800)
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#F9C000', color: '#00267F' }}
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
