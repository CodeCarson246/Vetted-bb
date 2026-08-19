'use client'
import { useState } from 'react'
import { PARISHES } from '@/lib/parishes'

const NOTES_MAX = 300

const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5'
const fieldCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-gray-900 outline-none focus:border-gray-400 bg-white'

export default function VettedRisingForm() {
  const [form, setForm] = useState({ full_name: '', age: '', parish: '', skill: '', whatsapp: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentName, setSentName] = useState(null)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')

    let res
    try {
      res = await fetch('/api/vetted-rising', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } catch {
      // Network dropped. The form keeps everything the applicant typed.
      setError('We could not reach the server. Check your connection and try again.')
      setBusy(false)
      return
    }

    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      return
    }
    // Only swap the form out once it has actually saved.
    setSentName(form.full_name.trim().split(/\s+/)[0] || 'there')
  }

  if (sentName) {
    return (
      <div
        className="bg-white rounded-2xl px-6 py-10 sm:px-10 text-center"
        style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}
        role="status"
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: '#F9C000' }}
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00267F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thanks, {sentName}.</h3>
        <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
          We&apos;ll be in touch on WhatsApp within a few days.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl px-5 py-7 sm:px-8 sm:py-8 flex flex-col gap-5"
      style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}
      noValidate
    >
      <div>
        <label htmlFor="vr-name" className={labelCls}>Full name</label>
        <input
          id="vr-name" type="text" required autoComplete="name"
          value={form.full_name} onChange={e => set('full_name', e.target.value)}
          className={fieldCls}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="vr-age" className={labelCls}>Age</label>
          <input
            id="vr-age" type="number" required min={16} max={30} inputMode="numeric"
            value={form.age} onChange={e => set('age', e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor="vr-parish" className={labelCls}>Parish</label>
          <select
            id="vr-parish" required
            value={form.parish} onChange={e => set('parish', e.target.value)}
            className={fieldCls}
          >
            <option value="">Choose your parish</option>
            {PARISHES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="vr-skill" className={labelCls}>What do you do?</label>
        <input
          id="vr-skill" type="text" required
          placeholder="e.g. barber, electrician, photographer, baker"
          value={form.skill} onChange={e => set('skill', e.target.value)}
          className={fieldCls}
        />
      </div>

      <div>
        <label htmlFor="vr-whatsapp" className={labelCls}>WhatsApp number</label>
        <input
          id="vr-whatsapp" type="tel" required autoComplete="tel"
          placeholder="+1 (246) 000-0000"
          value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
          className={fieldCls}
        />
      </div>

      <div>
        <label htmlFor="vr-notes" className={labelCls}>
          Anything else we should know? <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="vr-notes" rows={4} maxLength={NOTES_MAX}
          placeholder="Optional, tell us anything you'd like us to know"
          value={form.notes} onChange={e => set('notes', e.target.value)}
          className={fieldCls + ' resize-y'}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{form.notes.length}/{NOTES_MAX}</p>
      </div>

      {error && (
        <p className="text-sm rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto sm:self-start text-base font-semibold px-8 py-3.5 rounded-full text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: '#00267F' }}
      >
        {busy ? 'Sending…' : 'Send my application'}
      </button>
    </form>
  )
}
