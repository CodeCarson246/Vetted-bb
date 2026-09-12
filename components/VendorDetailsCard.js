'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PARISHES } from '@/lib/parishes'
import { VENDOR_CLASSIFICATIONS, VENDOR_STATUSES, vendorStatusLabel } from '@/lib/organisations'

const fieldCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

const EMPTY = {
  address_line1: '', address_line2: '', city_town: '', parish: '', country: 'Barbados',
  vendor_classification: '', tamis_number: '', company_registration_number: '', small_business_association_number: '',
}

// Billing address and government vendor details for a freelancer.
//
// Two tabs. "Billing details" is what gets printed on their quotes and
// invoices. "Vendor registration" explains the Treasury vendor process and
// shows a checklist of what the form asks for, with their saved values
// beside each item so they can copy them across.
//
// Deliberately NOT here: any generation, pre-filling or hosting of the
// government form itself (not without written permission from Treasury),
// and any bank details (never stored on Vetted.bb).
export default function VendorDetailsCard({ freelancerId, initialStatus = 'not_registered' }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('details')
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState(initialStatus || 'not_registered')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || loaded || !freelancerId) return
    let cancelled = false
    supabase.from('freelancer_billing').select('*').eq('freelancer_id', freelancerId).maybeSingle().then(({ data }) => {
      if (cancelled) return
      if (data) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])) })
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [open, loaded, freelancerId])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const row = { freelancer_id: freelancerId, updated_at: new Date().toISOString() }
    for (const k of Object.keys(EMPTY)) row[k] = (form[k] || '').toString().trim() || null
    if (!row.country) row.country = 'Barbados'
    const { error: upErr } = await supabase.from('freelancer_billing').upsert(row, { onConflict: 'freelancer_id' })
    setSaving(false)
    if (upErr) { setError(upErr.message || 'Could not save. Please try again.'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function changeStatus(next) {
    const prev = status
    setStatus(next)
    const { error: stErr } = await supabase.from('freelancers').update({ govt_vendor_status: next }).eq('id', freelancerId)
    if (stErr) { setStatus(prev); setError('Could not update your vendor status. Please try again.') }
  }

  const classificationLabel = VENDOR_CLASSIFICATIONS.find(c => c.value === form.vendor_classification)?.label
  const addressSummary = [form.address_line1, form.address_line2, form.city_town, form.parish, form.country].filter(Boolean).join(', ')

  // Checklist rows: [label, the value we hold (or null), note]
  const checklist = [
    ['Vendor name', null, 'Your legal or trading name, exactly as the ministry should pay it.'],
    ['Vendor classification', classificationLabel || null, 'Employee, Small Business, Other Business, Medium Size Business or Large Business.'],
    ['TAMIS number', form.tamis_number || null, 'Your Barbados Revenue Authority taxpayer number.'],
    ['Company registration number', form.company_registration_number || null, 'Only if you are a registered company.'],
    ['Small Business Association number', form.small_business_association_number || null, 'Only if you are an SBA member.'],
    ['Vendor address', addressSummary || null, null],
    ['Vendor email address', null, 'The email you use on Vetted.bb is usually the right one.'],
    ['Bank details', 'never stored here', 'Bank name, account number, branch, name on account, account type, BIC/SWIFT. You fill these in yourself on the form.'],
  ]

  return (
    <div id="vendor-details" className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 sm:px-8 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#00267F' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <span className="font-semibold text-gray-900 block">Billing &amp; vendor details</span>
            <span className="text-xs text-gray-500">Address for your invoices · {vendorStatusLabel(status)}</span>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <div className="flex border-b border-gray-100 px-2">
            {[['details', 'Billing details'], ['registration', 'Vendor registration']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-5 py-3.5 text-sm font-semibold transition-colors relative ${tab === k ? '' : 'text-gray-400 hover:text-gray-600'}`} style={tab === k ? { color: '#00267F' } : {}}>
                {label}
                {tab === k && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: '#00267F' }} />}
              </button>
            ))}
          </div>

          {!loaded ? (
            <p className="px-6 sm:px-8 py-8 text-sm text-gray-400">Loading…</p>
          ) : tab === 'details' ? (
            <form onSubmit={save} className="px-6 sm:px-8 py-6 flex flex-col gap-5">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Billing address</h3>
                <p className="text-sm text-gray-500 mb-4">Printed in the “From” block on every quote and invoice you send. Organisations and government need a proper address on the document.</p>
                <div className="flex flex-col gap-3">
                  <input className={fieldCls} placeholder="Address line 1" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
                  <input className={fieldCls} placeholder="Address line 2 (optional)" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input className={fieldCls} placeholder="Town or area" value={form.city_town} onChange={e => set('city_town', e.target.value)} />
                    <select className={fieldCls} value={form.parish} onChange={e => set('parish', e.target.value)}>
                      <option value="">Parish</option>
                      {PARISHES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input className={fieldCls} placeholder="Country" value={form.country} onChange={e => set('country', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-1">Vendor details</h3>
                <p className="text-sm text-gray-500 mb-4">What government and larger organisations ask for when they set you up as a supplier. All optional, and none of it appears on your public profile.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Vendor classification</label>
                    <select className={fieldCls} value={form.vendor_classification} onChange={e => set('vendor_classification', e.target.value)}>
                      <option value="">Choose one</option>
                      {VENDOR_CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>TAMIS number</label>
                    <input className={fieldCls} value={form.tamis_number} onChange={e => set('tamis_number', e.target.value)} autoComplete="off" />
                  </div>
                  <div>
                    <label className={labelCls}>Company registration no.</label>
                    <input className={fieldCls} value={form.company_registration_number} onChange={e => set('company_registration_number', e.target.value)} autoComplete="off" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Small Business Association no.</label>
                    <input className={fieldCls} value={form.small_business_association_number} onChange={e => set('small_business_association_number', e.target.value)} autoComplete="off" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">We never ask for or store bank details. Those go directly to whoever is paying you.</p>
              </div>

              {error && <p className="text-sm rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
                  {saving ? 'Saving…' : 'Save details'}
                </button>
                {saved && <span className="text-sm font-medium" style={{ color: '#16a34a' }}>✓ Saved</span>}
              </div>
            </form>
          ) : (
            <div className="px-6 sm:px-8 py-6 flex flex-col gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Working for government</h3>
                <div className="text-sm text-gray-600 leading-relaxed flex flex-col gap-2">
                  <p>To be paid by a ministry or government department you need to be registered as a vendor with the Treasury. It is a one-time registration and it covers all of government, not just one ministry.</p>
                  <p>You do not submit the form yourself. The ministry engaging you gives you their vendor registration form, you complete it, and they submit it on your behalf. Your part is having the details ready.</p>
                  <p>Vetted.bb does not provide or fill in the form. The checklist below is what it asks for, with anything you have saved here shown beside it so you can copy it across.</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What the form asks for</p>
                <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {checklist.map(([label, value, note]) => (
                    <li key={label} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4" style={{ backgroundColor: 'var(--surface-card)' }}>
                      <div className="sm:w-52 flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
                      </div>
                      <p className="text-sm flex-1 min-w-0" style={{ color: value ? '#111827' : '#9ca3af' }}>
                        {value === 'never stored here' ? <span className="italic text-gray-400">You provide this yourself. Never stored on Vetted.bb.</span> : value || 'Not saved yet'}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 mt-2">Add or update your details on the Billing details tab.</p>
              </div>

              <div className="pt-5 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your vendor status</p>
                <p className="text-sm text-gray-500 mb-3">Organisations can filter the pool to registered vendors, and your card shows a “Govt vendor” badge once you are. Keep this accurate.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {VENDOR_STATUSES.map(s => {
                    const on = status === s.value
                    return (
                      <button key={s.value} type="button" onClick={() => changeStatus(s.value)} className="flex-1 py-2.5 px-3 rounded-lg border-2 text-sm font-semibold transition-colors text-left" style={on ? { borderColor: '#00267F', backgroundColor: 'var(--selected-fill)', color: 'var(--accent)' } : { borderColor: 'var(--border-card)', color: 'var(--foreground)' }}>
                        {s.label}
                      </button>
                    )
                  })}
                </div>
                {error && <p className="text-sm mt-3 rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
