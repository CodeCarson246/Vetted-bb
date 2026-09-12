'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
const BUCKET = 'quote-attachments'

const fmtSize = (n) => !n ? '' : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

// Purchase orders and other documents attached to a quote, visible to both
// parties. The bucket is private: files are opened through short-lived
// signed URLs, and who may see or add them is decided by the same rule as
// the quote itself (SUPABASE_SQL.sql section 30).
export default function QuoteAttachments({ quoteId, canUpload = true, label = 'Attach purchase order', kind = 'purchase_order', compact = false }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!quoteId) return
    const { data } = await supabase.from('quote_attachments').select('*').eq('quote_id', quoteId).order('created_at', { ascending: true })
    setItems(data || [])
    setLoaded(true)
  }, [quoteId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; state is set after the await, not synchronously
  useEffect(() => { load() }, [load])

  async function onPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!ALLOWED.includes(file.type)) { setError('Use a PDF, JPG, PNG or WebP file.'); return }
    if (file.size > MAX_BYTES) { setError('The file must be under 10MB.'); return }
    setBusy(true); setError('')
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
    const path = `${quoteId}/${crypto.randomUUID()}-${safeName}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type })
    if (upErr) { setError('Upload failed. Please try again.'); setBusy(false); return }
    const { error: rowErr } = await supabase.from('quote_attachments').insert({
      quote_id: quoteId, path, file_name: file.name.slice(0, 120), file_size: file.size, mime_type: file.type, kind, uploaded_by: user.id,
    })
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
      setError('Could not save the attachment. Please try again.')
    }
    setBusy(false)
    load()
  }

  async function open(item) {
    const { data, error: urlErr } = await supabase.storage.from(BUCKET).createSignedUrl(item.path, 120)
    if (urlErr || !data?.signedUrl) { setError('Could not open the file. Please try again.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function remove(item) {
    if (!confirm(`Remove ${item.file_name}?`)) return
    await supabase.storage.from(BUCKET).remove([item.path]).catch(() => {})
    await supabase.from('quote_attachments').delete().eq('id', item.id)
    load()
  }

  if (!loaded && !canUpload) return null
  if (loaded && items.length === 0 && !canUpload) return null

  return (
    <div className={compact ? 'mt-3' : 'mt-4 rounded-xl border border-gray-100 p-4'}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Attachments{items.length ? ` (${items.length})` : ''}
        </p>
        {canUpload && (
          <label className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer transition-colors hover:border-gray-400 ${busy ? 'opacity-50 pointer-events-none' : ''}`} style={{ borderColor: '#00267F', color: '#00267F' }}>
            {busy ? 'Uploading…' : `+ ${label}`}
            <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" disabled={busy} />
          </label>
        )}
      </div>

      {loaded && items.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-gray-100">
          {items.map(it => (
            <li key={it.id} className="py-2 flex items-center gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                {it.mime_type === 'application/pdf' ? 'PDF' : 'IMG'}
              </span>
              <button onClick={() => open(it)} className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-medium text-gray-900 truncate">{it.file_name}</span>
                <span className="block text-xs text-gray-400">{it.kind === 'purchase_order' ? 'Purchase order' : 'Attachment'}{it.file_size ? ` · ${fmtSize(it.file_size)}` : ''} · {new Date(it.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </button>
              <button onClick={() => open(it)} className="text-xs font-semibold flex-shrink-0" style={{ color: '#00267F' }}>Open</button>
              {user?.id === it.uploaded_by && (
                <button onClick={() => remove(it)} className="text-xs font-medium text-gray-400 hover:text-red-600 flex-shrink-0">Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && loaded && items.length === 0 && !error && (
        <p className="text-xs text-gray-400 mt-2">PDF or image, up to 10MB. Only the two parties to this quote can see it.</p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: '#991B1B' }} role="alert">{error}</p>}
    </div>
  )
}
