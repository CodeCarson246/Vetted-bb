'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import ThemeToggle from '@/components/ThemeToggle'
import InstallAppCard from '@/components/InstallAppCard'
import { getPushStatus, enablePush, disablePush } from '@/lib/push'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DURATIONS = [30, 45, 60, 90, 120, 180]

function Switch({ on, onClick }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} className="flex-shrink-0 transition-colors" style={{ width: 44, height: 26, borderRadius: 999, padding: 3, backgroundColor: on ? '#00267F' : '#D1D5DB', border: 'none', cursor: 'pointer' }}>
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.15s' }} />
    </button>
  )
}

function Card({ title, desc, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {desc && <p className="text-sm text-gray-500 mt-0.5 mb-4">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(false)
  const [pushState, setPushState] = useState('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const [services, setServices] = useState([])
  const [bk, setBk] = useState(null) // booking config (availability_settings)
  const [bkSaving, setBkSaving] = useState(false)
  const [bkSaved, setBkSaved] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [hiddenBusy, setHiddenBusy] = useState(false)
  const [showDeactConfirm, setShowDeactConfirm] = useState(false)
  const [deactBusy, setDeactBusy] = useState(false)
  const [deactError, setDeactError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    ;(async () => {
      const { data: fp } = await supabase.from('freelancers').select('id, name, trade, hidden').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      setProfile(fp || null)
      setHidden(!!fp?.hidden)
      if (fp) {
        const [{ data: svc }, { data: settings }] = await Promise.all([
          supabase.from('services').select('id, name, price, duration_minutes, bookable').eq('freelancer_id', fp.id).order('created_at', { ascending: true }),
          supabase.from('availability_settings').select('*').eq('freelancer_id', fp.id).maybeSingle(),
        ])
        if (cancelled) return
        setServices(svc || [])
        setBk(settings || { freelancer_id: fp.id, bookings_enabled: false, booking_mode: 'day', work_days: [1, 2, 3, 4, 5], work_start: '09:00', work_end: '17:00', lead_time_days: 1 })
      }
      if (!cancelled) setReady(true)
    })()
    getPushStatus().then(s => { if (!cancelled) setPushState(s) })
    return () => { cancelled = true }
  }, [user, authLoading, router])

  function patchBk(p) { setBk(b => ({ ...b, ...p })); setBkSaved(false) }
  function toggleService(id) { setServices(s => s.map(x => x.id === id ? { ...x, bookable: !x.bookable } : x)); setBkSaved(false) }
  function setServiceDur(id, v) { setServices(s => s.map(x => x.id === id ? { ...x, duration_minutes: Number(v) } : x)); setBkSaved(false) }
  function toggleDay(d) {
    setBk(b => {
      const days = b.work_days || []
      return { ...b, work_days: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, z) => a - z) }
    })
    setBkSaved(false)
  }

  async function saveBookings() {
    setBkSaving(true)
    await supabase.from('availability_settings').upsert({
      freelancer_id: profile.id,
      bookings_enabled: bk.bookings_enabled,
      booking_mode: bk.booking_mode,
      work_days: bk.work_days,
      work_start: bk.work_start,
      work_end: bk.work_end,
      lead_time_days: Number(bk.lead_time_days) || 0,
      show_on_profile: true,
    }, { onConflict: 'freelancer_id' })
    await Promise.all(services.map(s =>
      supabase.from('services').update({ bookable: !!s.bookable, duration_minutes: s.duration_minutes || null }).eq('id', s.id)
    ))
    setBkSaving(false)
    setBkSaved(true)
    setTimeout(() => setBkSaved(false), 2500)
  }

  async function toggleHidden() {
    const next = !hidden
    setHiddenBusy(true)
    const { error } = await supabase.from('freelancers').update({ hidden: next }).eq('id', profile.id)
    if (!error) setHidden(next)
    setHiddenBusy(false)
  }

  async function deactivateAccount() {
    setDeactBusy(true)
    setDeactError('')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'deactivate' }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setDeactError(body.error || 'Something went wrong. Please try again.')
      setDeactBusy(false)
      return
    }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function togglePush() {
    setPushBusy(true)
    if (pushState === 'subscribed') {
      await disablePush()
      setPushState('unsubscribed')
    } else {
      const { status } = await enablePush(user.id)
      setPushState(status || 'unsubscribed')
    }
    setPushBusy(false)
  }

  if (authLoading || !ready) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  const pushLabel = {
    subscribed: 'On', unsubscribed: 'Off', denied: 'Blocked in browser', 'not-configured': 'Unavailable', unsupported: 'Not supported on this device', error: 'Error, try again', unknown: '…',
  }[pushState] || 'Off'

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Manage your account, profile and preferences.</p>

        <div className="flex flex-col gap-4">
          <Card title="Account">
            <div className="flex items-center justify-between gap-3 py-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900 truncate">{user.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Account type</span>
              <span className="text-sm font-medium text-gray-900">{profile ? 'Freelancer' : 'Client'}</span>
            </div>
            <div className="pt-3 border-t border-gray-100 mt-1">
              <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })} className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors">
                Sign out
              </button>
            </div>
          </Card>

          {profile && (
            <Card title="Public profile" desc="Your listing as clients see it.">
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard" className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Edit profile</Link>
                <Link href={`/freelancers/${profile.id}`} className="text-sm font-semibold px-4 py-2 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F' }}>View public profile</Link>
              </div>
            </Card>
          )}

          {profile && bk && (
            <Card title="Bookings" desc="Let clients request bookings for the services you choose. Off by default, so quote-only trades can leave this disabled.">
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm font-medium text-gray-800">Accept booking requests</span>
                <Switch on={!!bk.bookings_enabled} onClick={() => patchBk({ bookings_enabled: !bk.bookings_enabled })} />
              </div>

              {bk.bookings_enabled && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How clients book</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[['day', 'Request a day', 'Client requests a date; you confirm and agree the time in chat.'], ['slot', 'Exact time slots', 'Client picks an open slot from your working hours.']].map(([val, label, sub]) => (
                        <button key={val} onClick={() => patchBk({ booking_mode: val })} className="text-left rounded-xl border-2 p-3 transition-colors" style={{ borderColor: bk.booking_mode === val ? '#00267F' : 'var(--border-card)', backgroundColor: bk.booking_mode === val ? 'var(--selected-fill)' : 'transparent' }}>
                          <span className="block text-sm font-semibold" style={{ color: bk.booking_mode === val ? 'var(--accent)' : 'var(--foreground)' }}>{label}</span>
                          <span className="block text-xs text-gray-500 mt-0.5">{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bookable services</p>
                    {services.length === 0 ? (
                      <p className="text-sm text-gray-400">Add services to your profile first, then mark which are bookable here.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {services.map(s => (
                          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                            <button onClick={() => toggleService(s.id)} aria-pressed={!!s.bookable} className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={s.bookable ? { backgroundColor: '#00267F', borderColor: '#00267F' } : { borderColor: '#D1D5DB' }}>
                              {s.bookable && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{s.name}</span>
                            {s.bookable && (
                              <select value={s.duration_minutes || 60} onChange={e => setServiceDur(s.id, e.target.value)} className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 outline-none focus:border-gray-400">
                                {DURATIONS.map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60}h${m % 60 ? ` ${m % 60}m` : ''}`}</option>)}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {bk.booking_mode === 'slot' && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Working hours</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {DAY_LABELS.map((d, i) => {
                          const on = (bk.work_days || []).includes(i)
                          return <button key={i} onClick={() => toggleDay(i)} className="w-9 h-9 rounded-lg text-xs font-semibold transition-colors" style={on ? { backgroundColor: '#00267F', color: '#fff' } : { backgroundColor: 'var(--row-stripe)', color: '#6B7280', border: '1px solid var(--border-card)' }}>{d}</button>
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <input type="time" value={bk.work_start} onChange={e => patchBk({ work_start: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-900 outline-none focus:border-gray-400" />
                        <span className="text-gray-400">to</span>
                        <input type="time" value={bk.work_end} onChange={e => patchBk({ work_end: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-900 outline-none focus:border-gray-400" />
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Earliest a client can book</p>
                    <select value={bk.lead_time_days} onChange={e => patchBk({ lead_time_days: Number(e.target.value) })} className="text-sm px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 outline-none focus:border-gray-400">
                      {[0, 1, 2, 3, 7].map(d => <option key={d} value={d}>{d === 0 ? 'Same day' : d === 1 ? 'From tomorrow' : `${d} days ahead`}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-5">
                <button onClick={saveBookings} disabled={bkSaving} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>{bkSaving ? 'Saving…' : 'Save booking settings'}</button>
                {bkSaved && <span className="text-sm font-medium" style={{ color: '#16a34a' }}>✓ Saved</span>}
              </div>
            </Card>
          )}

          <Card title="Notifications" desc="Get push alerts for new messages, quotes and bookings, even when the app is closed.">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">Push notifications · <span className="font-semibold">{pushLabel}</span></span>
              {['subscribed', 'unsubscribed', 'error', 'unknown'].includes(pushState) && (
                <button onClick={togglePush} disabled={pushBusy} className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 disabled:opacity-50 transition-opacity" style={{ backgroundColor: pushState === 'subscribed' ? '#6B7280' : '#00267F' }}>
                  {pushBusy ? '…' : pushState === 'subscribed' ? 'Turn off' : 'Turn on'}
                </button>
              )}
            </div>
            {pushState === 'denied' && <p className="text-xs text-gray-400 mt-2">Notifications are blocked in your browser settings. Re-enable them there to turn this on.</p>}
          </Card>

          <InstallAppCard />

          {profile && (
            <Card title="Profile visibility" desc="Hide your public profile without deactivating. You disappear from search, categories and featured listings, while existing conversations, quotes and bookings keep working. Turn it back on any time.">
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm font-medium text-gray-800">
                  {hidden ? 'Profile is hidden from the marketplace' : 'Profile is visible on the marketplace'}
                </span>
                <Switch on={hidden} onClick={() => { if (!hiddenBusy) toggleHidden() }} />
              </div>
              {hidden && (
                <p className="text-xs mt-2" style={{ color: '#b45309' }}>
                  Clients can no longer find you or view your profile page. Flip the switch to go live again.
                </p>
              )}
            </Card>
          )}

          <Card title="Appearance" desc="Switch between light and dark mode.">
            <ThemeToggle />
          </Card>

          <div className="rounded-2xl p-5 sm:p-6" style={{ border: '1px solid #fecaca', backgroundColor: 'rgba(239,68,68,0.04)' }}>
            <h2 className="font-semibold" style={{ color: '#b91c1c' }}>Deactivate account</h2>
            <p className="text-sm text-gray-500 mt-0.5 mb-4">
              Takes your account down immediately. You have <strong>60 days</strong> to change your mind. Just log
              back in and hit Reactivate. After that, your account and all its data are permanently deleted.
            </p>
            <button
              onClick={() => setShowDeactConfirm(true)}
              className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#dc2626' }}
            >
              Deactivate my account
            </button>
          </div>
        </div>
      </div>

      {showDeactConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { if (!deactBusy) setShowDeactConfirm(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Deactivate your account?</h3>
            <div className="text-sm text-gray-600 leading-relaxed mb-4">
              <p className="mb-2">Here&apos;s what happens next:</p>
              <ul className="list-disc list-inside space-y-1">
                {profile && <li>Your public profile and services come down immediately.</li>}
                <li>You&apos;ll be signed out on all devices you use.</li>
                <li>For <strong>60 days</strong> you can log back in and reactivate. Everything is restored.</li>
                <li>After 60 days, your account and all data are <strong>permanently deleted</strong>.</li>
              </ul>
            </div>
            {deactError && <p className="text-sm mb-3" style={{ color: '#dc2626' }}>{deactError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeactConfirm(false)} disabled={deactBusy} className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors disabled:opacity-50">
                Keep my account
              </button>
              <button onClick={deactivateAccount} disabled={deactBusy} className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#dc2626' }}>
                {deactBusy ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
