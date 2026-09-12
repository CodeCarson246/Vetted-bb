'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'

const fieldCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'

// Who can act for the organisation. Everyone signs in as themselves; owners
// invite colleagues by email and can remove members or revoke invites.
export default function OrganisationTeam() {
  const { user, org, isOwner, loading } = useOrganisation()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastLink, setLastLink] = useState('')

  const load = useCallback(async () => {
    if (!org) return
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.from('organisation_members').select('user_id, role, email, full_name, created_at').eq('organisation_id', org.id).order('created_at', { ascending: true }),
      isOwner
        ? supabase.from('organisation_invites').select('id, email, role, token, expires_at, accepted_at, created_at').eq('organisation_id', org.id).is('accepted_at', null).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setMembers(m || [])
    setInvites(i || [])
    setReady(true)
  }, [org, isOwner])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; state is set after the awaits, not synchronously
  useEffect(() => { if (!loading && org) load() }, [loading, org, load])

  async function sendInvite(e) {
    e.preventDefault()
    if (!isOwner) return
    setBusy(true); setError(''); setNotice(''); setLastLink('')
    const { data: { session } } = await supabase.auth.getSession()
    let res, body
    try {
      res = await fetch('/api/organisation-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ organisation_id: org.id, email: email.trim(), role }),
      })
      body = await res.json().catch(() => ({}))
    } catch {
      setError('Could not reach the server. Please try again.'); setBusy(false); return
    }
    setBusy(false)
    if (!res.ok) { setError(body.error || 'Could not send the invitation.'); return }
    setEmail('')
    setNotice(`Invitation sent to ${email.trim()}.`)
    setLastLink(body.link || '')
    load()
  }

  async function revoke(id) {
    if (!confirm('Revoke this invitation?')) return
    await supabase.from('organisation_invites').delete().eq('id', id)
    load()
  }

  async function removeMember(m) {
    if (m.user_id === user.id) return
    if (!confirm(`Remove ${m.full_name || m.email || 'this member'} from ${org.name}?`)) return
    await supabase.from('organisation_members').delete().eq('organisation_id', org.id).eq('user_id', m.user_id)
    load()
  }

  function copy(text) {
    try { navigator.clipboard.writeText(text); setNotice('Link copied.') } catch { /* ignore */ }
  }

  if (loading || !org) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  const owners = members.filter(m => m.role === 'owner').length

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Team</h1>
        <p className="text-sm text-gray-500 mb-6">Everyone here can search, enquire and see {org.name}&apos;s quotes and jobs. Each person signs in as themselves, so the record shows who did what.</p>

        <div className="flex flex-col gap-4">
          {/* Members */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Members ({members.length})</h2>
            {!ready ? <p className="text-sm text-gray-400">Loading…</p> : (
              <ul className="divide-y divide-gray-100">
                {members.map(m => (
                  <li key={m.user_id} className="py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                      {(m.full_name || m.email || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.full_name || m.email || 'Member'}{m.user_id === user.id && <span className="font-normal text-gray-400"> (you)</span>}</p>
                      {m.full_name && m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={m.role === 'owner' ? { backgroundColor: '#F9C000', color: '#00267F' } : { backgroundColor: '#F3F4F6', color: '#4B5563' }}>
                      {m.role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                    {isOwner && m.user_id !== user.id && !(m.role === 'owner' && owners <= 1) && (
                      <button onClick={() => removeMember(m)} className="text-xs font-medium text-gray-400 hover:text-red-600 transition-colors">Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invite */}
          {isOwner && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Invite a colleague</h2>
              <p className="text-sm text-gray-500 mb-4">They get an email with a link. They must sign up or log in with that same address.</p>
              <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-3">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@example.com" className={fieldCls + ' flex-1'} />
                <select value={role} onChange={e => setRole(e.target.value)} className={fieldCls + ' sm:w-36'}>
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </select>
                <button type="submit" disabled={busy} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-50 flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                  {busy ? 'Sending…' : 'Send invite'}
                </button>
              </form>
              {error && <p className="text-sm mt-3 rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}
              {notice && <p className="text-sm mt-3 font-medium" style={{ color: '#16a34a' }}>{notice}</p>}
              {lastLink && (
                <div className="mt-3 rounded-xl px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center gap-2" style={{ backgroundColor: 'var(--row-stripe)', border: '1px solid var(--border-card)' }}>
                  <span className="text-gray-500 flex-shrink-0">If the email doesn&apos;t arrive, share this link:</span>
                  <code className="flex-1 truncate text-gray-700">{lastLink}</code>
                  <button type="button" onClick={() => copy(lastLink)} className="font-semibold flex-shrink-0" style={{ color: '#00267F' }}>Copy</button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">Owners can edit the organisation, invite and remove people. Members can do everything else.</p>
            </div>
          )}

          {/* Pending invites */}
          {isOwner && ready && invites.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Pending invitations ({invites.length})</h2>
              <ul className="divide-y divide-gray-100">
                {invites.map(i => {
                  const expired = new Date(i.expires_at) < new Date()
                  const link = `${window.location.origin}/organisation/accept?token=${i.token}`
                  return (
                    <li key={i.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{i.email}</p>
                        <p className="text-xs text-gray-400">{i.role === 'owner' ? 'Owner' : 'Member'} · {expired ? 'Expired' : `Expires ${new Date(i.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}</p>
                      </div>
                      {!expired && <button onClick={() => copy(link)} className="text-xs font-semibold" style={{ color: '#00267F' }}>Copy link</button>}
                      <button onClick={() => revoke(i.id)} className="text-xs font-medium text-gray-400 hover:text-red-600 transition-colors">Revoke</button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
