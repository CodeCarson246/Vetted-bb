'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { ORG_KINDS } from '@/lib/organisations'
import { PARISHES } from '@/lib/parishes'
import { PAYMENT_TERMS } from '@/lib/paymentTerms'

const fieldCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white disabled:opacity-60'
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

// Organisation details. Owners edit; members can see them. The address and
// division are what professionals print in the "Bill to" block, and the
// default payment term is what their quotes start from.
export default function OrganisationSettings() {
  const { org, isOwner, loading, refresh } = useOrganisation()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!org) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the form once the org row arrives
    setForm({
      name: org.name || '', division: org.division || '', kind: org.kind || 'business',
      address_line1: org.address_line1 || '', address_line2: org.address_line2 || '',
      city_town: org.city_town || '', parish: org.parish || '', country: org.country || 'Barbados',
      email: org.email || '', phone: org.phone || '',
      default_payment_terms: org.default_payment_terms || 'net30',
    })
  }, [org])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function save(e) {
    e.preventDefault()
    if (!isOwner || !form) return
    if (form.name.trim().length < 2) { setError('The organisation needs a name.'); return }
    setSaving(true); setError('')
    const patch = { ...form, name: form.name.trim(), updated_at: new Date().toISOString() }
    for (const k of ['division', 'address_line1', 'address_line2', 'city_town', 'parish', 'email', 'phone']) patch[k] = patch[k].trim() || null
    const { error: upErr } = await supabase.from('organisations').update(patch).eq('id', org.id)
    setSaving(false)
    if (upErr) { setError(upErr.message || 'Could not save. Please try again.'); return }
    setSaved(true)
    refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading || !org || !form) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Organisation settings</h1>
        <p className="text-sm text-gray-500 mb-6">
          {isOwner ? 'These details appear on every quote and invoice a professional sends you, so keep them accurate.' : 'Only an owner can change these details.'}
        </p>

        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-900">Identity</h2>
            <div>
              <label className={labelCls}>Organisation name</label>
              <input className={fieldCls} value={form.name} onChange={e => set('name', e.target.value)} disabled={!isOwner} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Division or department <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input className={fieldCls} value={form.division} onChange={e => set('division', e.target.value)} disabled={!isOwner} placeholder="e.g. Division of Youth" />
                <p className="text-xs text-gray-400 mt-1">Printed under the name in the “Bill to” block.</p>
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select className={fieldCls} value={form.kind} onChange={e => set('kind', e.target.value)} disabled={!isOwner}>
                  {ORG_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 border-t border-gray-100 text-sm">
              <span className="text-gray-500">Verification</span>
              {org.verified
                ? <span className="font-semibold" style={{ color: '#166534' }}>✓ Verified organisation</span>
                : <span className="text-gray-500">Pending. Checked manually by Vetted.bb.</span>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Billing address</h2>
              <p className="text-sm text-gray-500 mt-0.5">What professionals print on their quotes and invoices to you.</p>
            </div>
            <div>
              <label className={labelCls}>Address line 1</label>
              <input className={fieldCls} value={form.address_line1} onChange={e => set('address_line1', e.target.value)} disabled={!isOwner} placeholder="Building, street" />
            </div>
            <div>
              <label className={labelCls}>Address line 2 <span className="normal-case font-normal text-gray-400">(optional)</span></label>
              <input className={fieldCls} value={form.address_line2} onChange={e => set('address_line2', e.target.value)} disabled={!isOwner} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Town or area</label>
                <input className={fieldCls} value={form.city_town} onChange={e => set('city_town', e.target.value)} disabled={!isOwner} />
              </div>
              <div>
                <label className={labelCls}>Parish</label>
                <select className={fieldCls} value={form.parish} onChange={e => set('parish', e.target.value)} disabled={!isOwner}>
                  <option value="">Choose</option>
                  {PARISHES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input className={fieldCls} value={form.country} onChange={e => set('country', e.target.value)} disabled={!isOwner} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-900">Contact and terms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Accounts email <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input type="email" className={fieldCls} value={form.email} onChange={e => set('email', e.target.value)} disabled={!isOwner} />
              </div>
              <div>
                <label className={labelCls}>Phone <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input type="tel" className={fieldCls} value={form.phone} onChange={e => set('phone', e.target.value)} disabled={!isOwner} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Default payment terms</label>
              <select className={fieldCls} value={form.default_payment_terms} onChange={e => set('default_payment_terms', e.target.value)} disabled={!isOwner}>
                {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Quotes to you start from this term. Professionals can still adjust it on a quote.</p>
            </div>
          </div>

          {error && <p className="text-sm rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}

          {isOwner && (
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className="text-sm font-medium" style={{ color: '#16a34a' }}>✓ Saved</span>}
            </div>
          )}
        </form>
      </div>
    </main>
  )
}
