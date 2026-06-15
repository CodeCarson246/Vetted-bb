'use client'
import { useState, useEffect } from 'react'
import { getPushStatus, enablePush, disablePush } from '@/lib/push'

/**
 * "Get notified" card — shown on the dashboard so freelancers can turn
 * browser push notifications on/off for new inquiries.
 */
export default function PushToggle({ userId }) {
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPushStatus().then(setStatus)
  }, [])

  if (status === 'loading' || status === 'unsupported') return null

  async function handleToggle() {
    setBusy(true)
    if (status === 'subscribed') {
      const result = await disablePush()
      if (result === 'unsubscribed') setStatus('unsubscribed')
    } else {
      const result = await enablePush(userId)
      setStatus(result === 'subscribed' ? 'subscribed' : result === 'denied' ? 'denied' : status)
      if (result === 'not-configured') alert('Push notifications aren’t set up on the server yet. Please try again later.')
      else if (result === 'error') alert('Could not enable notifications. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4" style={{ borderLeft: '4px solid #F9C000' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(249,192,0,0.15)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d9a800" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">Push notifications</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {status === 'subscribed'
            ? 'On — you’ll be notified of new inquiries on this device.'
            : status === 'denied'
            ? 'Blocked in your browser settings. Allow notifications for this site to turn them on.'
            : 'Get notified the moment a client messages you, even when the site is closed.'}
        </p>
      </div>
      {status !== 'denied' && (
        <button
          onClick={handleToggle}
          disabled={busy}
          className={`text-xs font-semibold px-4 py-2 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${
            status === 'subscribed'
              ? 'border border-gray-300 text-gray-500 hover:border-gray-500'
              : 'text-white hover:opacity-90'
          }`}
          style={status === 'subscribed' ? {} : { backgroundColor: '#00267F' }}
        >
          {busy ? 'Working…' : status === 'subscribed' ? 'Turn off' : 'Turn on'}
        </button>
      )}
    </div>
  )
}
