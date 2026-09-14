'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { SITE_HOST, SITE_URL } from '@/lib/siteUrl'
import { HANDLE_RE, HANDLE_PROBLEMS, suggestHandle } from '@/lib/handles'

// "Your profile link": pick or change the handle that replaces the uuid in
// the profile URL. Availability is checked live against the database
// rules (handle_available) and saved through set_handle, which is the only
// path allowed to write the column.
export default function ProfileHandleCard({ profile, onSaved }) {
  const current = profile?.handle || ''
  const [value, setValue] = useState(current || suggestHandle(profile?.name))
  const [status, setStatus] = useState(null)    // null | 'checking' | 'available' | 'current' | <problem code>
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const timer = useRef(null)

  const cooldownUntil = profile?.handle_changed_at
    ? new Date(new Date(profile.handle_changed_at).getTime() + 30 * 24 * 3600 * 1000)
    : null
  const inCooldown = !!cooldownUntil && cooldownUntil > new Date()

  // Debounced availability check as they type.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- mirrors the typed value into a status while the database check (an external system) runs */
    setError('')
    setSaved(false)
    const v = value.trim()
    if (!v) { setStatus(null); return }
    if (current && v.toLowerCase() === current.toLowerCase()) { setStatus('current'); return }
    if (!HANDLE_RE.test(v)) { setStatus('format'); return }
    setStatus('checking')
    /* eslint-enable react-hooks/set-state-in-effect */
    clearTimeout(timer.current)
    let cancelled = false
    timer.current = setTimeout(async () => {
      const { data, error: rpcErr } = await supabase.rpc('handle_available', { p_handle: v, p_freelancer_id: profile?.id || null })
      if (cancelled) return
      if (rpcErr) { setStatus(null); setError('Could not check that handle right now. Please try again.'); return }
      setStatus(data || 'available')
    }, 400)
    return () => { cancelled = true; clearTimeout(timer.current) }
  }, [value, current, profile?.id])

  async function save() {
    const v = value.trim()
    if (saving || !v) return
    setSaving(true); setError('')
    const { data, error: rpcErr } = await supabase.rpc('set_handle', { p_freelancer_id: profile.id, p_handle: v })
    setSaving(false)
    if (rpcErr) { setError('Could not save your handle. Please try again.'); return }
    if (data?.error) { setError(HANDLE_PROBLEMS[data.error] || 'That handle cannot be used.'); return }
    setSaved(true)
    setStatus('current')
    onSaved?.(data.handle)
  }

  const casingOnly = !!current && value.trim() !== current && value.trim().toLowerCase() === current.toLowerCase()
  const canSave = !saving && !!value.trim() && (status === 'available' || casingOnly) && (!inCooldown || casingOnly)
  const problem = status && !['checking', 'available', 'current'].includes(status) ? HANDLE_PROBLEMS[status] : ''

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">Your profile link</p>
          <p className="text-xs text-gray-500">
            {current
              ? 'Pick something short that matches your business. Letters, numbers and hyphens.'
              : 'Replace the long code in your profile address with a name people can remember and type.'}
          </p>
        </div>
        {current && (
          <a href={`${SITE_URL}/freelancers/${current}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: '#00267F' }}>
            Open ↗
          </a>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 flex items-center rounded-xl border border-gray-200 overflow-hidden focus-within:border-gray-400" style={{ backgroundColor: 'var(--row-stripe)' }}>
          <span className="pl-3 pr-1 text-sm text-gray-400 whitespace-nowrap select-none">{SITE_HOST}/freelancers/</span>
          <input
            value={value}
            onChange={e => setValue(e.target.value.replace(/\s+/g, ''))}
            maxLength={30}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="YourBusiness"
            aria-label="Profile handle"
            className="flex-1 min-w-0 py-2.5 pr-3 text-sm font-semibold bg-transparent outline-none text-gray-900"
          />
        </label>
        <button
          onClick={save}
          disabled={!canSave}
          className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: '#00267F', color: '#fff' }}
        >
          {saving ? 'Saving…' : current ? 'Change' : 'Claim it'}
        </button>
      </div>

      <div className="mt-2 min-h-[1.25rem] text-xs">
        {error ? <span style={{ color: '#B91C1C' }}>{error}</span>
          : saved ? <span style={{ color: '#166534' }}>Saved. Your profile now lives at {SITE_HOST}/freelancers/{current || value.trim()}</span>
          : status === 'checking' ? <span className="text-gray-400">Checking…</span>
          : status === 'available' ? <span style={{ color: '#166534' }}>✓ {value.trim()} is available</span>
          : status === 'current' ? <span className="text-gray-400">This is your current handle.</span>
          : problem ? <span style={{ color: '#B45309' }}>{problem}</span>
          : <span className="text-gray-400">Your old link keeps working and redirects to the new one.</span>}
      </div>

      {inCooldown && !casingOnly && (
        <p className="mt-2 text-xs text-gray-400">
          You can change it again on {cooldownUntil.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Changing only the capitalisation is always allowed.
        </p>
      )}
    </div>
  )
}
