'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { ORG_KINDS, fetchMyOrganisation, consumePendingInvite } from '@/lib/organisations'

// Landing spot for an organisation user who has no organisation yet: a
// Google sign-up that lost the stashed name, or an old account. One form,
// then straight into the workspace.
export default function OrganisationSetup() {
  const router = useRouter()
  const { loading, org } = useOrganisation({ allowMissing: true })
  const [name, setName] = useState('')
  const [kind, setKind] = useState('business')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // If they arrived with an invite, redeem it instead of creating a new org.
  useEffect(() => {
    if (loading) return
    if (org) { router.replace('/organisation'); return }
    consumePendingInvite().then(joined => { if (joined) router.replace('/organisation') })
  }, [loading, org, router])

  async function submit(e) {
    e.preventDefault()
    if (name.trim().length < 2) { setError('Please enter your organisation’s name.'); return }
    setBusy(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('create_organisation', { p_name: name.trim(), p_kind: kind })
    if (rpcError) {
      setError(rpcError.message || 'Could not create the organisation. Please try again.')
      setBusy(false)
      return
    }
    await supabase.auth.updateUser({ data: { organisation_name: name.trim(), organisation_kind: kind } })
    await fetchMyOrganisation()
    router.replace('/organisation')
  }

  if (loading) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  return (
    <main className="min-h-screen page-bg flex items-center justify-center px-4 py-12">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-md p-7 sm:p-8 flex flex-col gap-5"
        style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Set up your organisation</h1>
          <p className="text-sm text-gray-500">Tell us who you’re hiring for. You can add the address and your team afterwards.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organisation name</label>
          <input
            type="text" required autoFocus
            value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Sunrise Events Ltd"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type of organisation</label>
          <select
            value={kind} onChange={e => setKind(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
          >
            {ORG_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>

        {error && <p className="text-sm rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}

        <button
          type="submit" disabled={busy}
          className="w-full text-white py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#00267F' }}
        >
          {busy ? 'Creating…' : 'Create organisation'}
        </button>
      </form>
    </main>
  )
}
