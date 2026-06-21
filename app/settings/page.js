'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import ThemeToggle from '@/components/ThemeToggle'
import { pushSupported, getPushStatus, enablePush, disablePush } from '@/lib/push'

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

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    supabase.from('freelancers').select('id, name, trade').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setProfile(data || null); setReady(true) } })
    if (pushSupported()) getPushStatus().then(s => { if (!cancelled) setPushState(s) })
    else setPushState('unsupported')
    return () => { cancelled = true }
  }, [user, authLoading, router])

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
    subscribed: 'On', unsubscribed: 'Off', denied: 'Blocked in browser', 'not-configured': 'Unavailable', unsupported: 'Not supported on this device', error: 'Error — try again', unknown: '…',
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
                <a href="/dashboard" className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Edit profile</a>
                <a href={`/freelancers/${profile.id}`} className="text-sm font-semibold px-4 py-2 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F' }}>View public profile</a>
              </div>
            </Card>
          )}

          <Card title="Notifications" desc="Get push alerts for new messages, quotes and bookings — even when the app is closed.">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">Push notifications · <span className="font-semibold">{pushLabel}</span></span>
              {['subscribed', 'unsubscribed', 'error', 'unknown'].includes(pushState) && (
                <button onClick={togglePush} disabled={pushBusy} className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 disabled:opacity-50 transition-opacity" style={{ backgroundColor: pushState === 'subscribed' ? '#6B7280' : '#00267F' }}>
                  {pushBusy ? '…' : pushState === 'subscribed' ? 'Turn off' : 'Turn on'}
                </button>
              )}
            </div>
            {pushState === 'denied' && <p className="text-xs text-gray-400 mt-2">Notifications are blocked in your browser settings — re-enable them there to turn this on.</p>}
          </Card>

          <Card title="Appearance" desc="Switch between light and dark mode.">
            <ThemeToggle />
          </Card>
        </div>
      </div>
    </main>
  )
}
