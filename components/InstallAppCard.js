'use client'
import { useEffect, useState } from 'react'
import { subscribeInstall, canInstall, promptInstall, isStandalone, detectPlatform } from '@/lib/install'

// iOS Safari's Share glyph, drawn inline so the instructions can point at the
// exact icon the user is looking for.
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: '-2px', margin: '0 1px' }} aria-hidden="true">
      <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

// Settings card that always gives a working path to install the app, tailored
// to the device. Android/desktop Chromium get a one-tap Install button; iOS
// gets the Share → Add to Home Screen steps; in-app browsers get told to open
// in the real browser first.
export default function InstallAppCard() {
  const [mounted, setMounted] = useState(false)
  const [installable, setInstallable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [plat, setPlat] = useState({ iOS: false, iOSSafari: false, android: false, inAppBrowser: false })
  const [busy, setBusy] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    // Client-only reads done once on mount (guards against SSR hydration
    // mismatch: the server renders the neutral placeholder, the client then
    // swaps in device-specific instructions).
    /* eslint-disable react-hooks/set-state-in-effect -- one-time mount read + external subscription */
    setMounted(true)
    setPlat(detectPlatform())
    setInstalled(isStandalone())
    setInstallable(canInstall())
    /* eslint-enable react-hooks/set-state-in-effect */
    const unsub = subscribeInstall(() => setInstallable(canInstall()))
    return unsub
  }, [])

  async function onInstall() {
    setBusy(true)
    const outcome = await promptInstall()
    setBusy(false)
    if (outcome === 'accepted') setJustInstalled(true)
  }

  const numbered = (items) => (
    <ol className="flex flex-col gap-2.5 mt-1">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
          <span className="flex-shrink-0 flex items-center justify-center text-xs font-bold text-white rounded-full" style={{ width: 20, height: 20, backgroundColor: '#00267F' }}>{i + 1}</span>
          <span className="leading-snug">{it}</span>
        </li>
      ))}
    </ol>
  )

  let body = null
  if (!mounted) {
    body = <p className="text-sm text-gray-400">…</p>
  } else if (installed || justInstalled) {
    body = (
      <p className="text-sm font-medium flex items-center gap-2" style={{ color: '#16a34a' }}>
        <span aria-hidden="true">✓</span> Installed. Open Vetted.bb from your home screen any time.
      </p>
    )
  } else if (installable) {
    // Android / desktop Chromium — fire the real prompt.
    body = (
      <div>
        <button onClick={onInstall} disabled={busy} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-50 transition-opacity" style={{ backgroundColor: '#00267F' }}>
          {busy ? 'Opening…' : 'Install app'}
        </button>
        <p className="text-xs text-gray-400 mt-2">If nothing happens, use your browser menu and choose “Install app” or “Add to Home screen”.</p>
      </div>
    )
  } else if (plat.inAppBrowser) {
    body = (
      <div>
        <p className="text-sm text-gray-600 mb-1">You&apos;re viewing this inside another app&apos;s browser, which can&apos;t add to your home screen.</p>
        {numbered([
          <>Tap the menu (<strong>•••</strong> or the share icon) in this window.</>,
          <>Choose <strong>Open in {plat.iOS ? 'Safari' : 'Browser'}</strong>.</>,
          <>Then follow the install steps there.</>,
        ])}
      </div>
    )
  } else if (plat.iOS) {
    body = (
      <div>
        {numbered([
          <>Tap the Share icon <ShareIcon /> in Safari&apos;s toolbar.</>,
          <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
          <>Tap <strong>Add</strong> in the top corner.</>,
        ])}
        <p className="text-xs text-gray-400 mt-3">On iPhone, installing is also what enables push notifications.</p>
      </div>
    )
  } else if (plat.android) {
    body = (
      <div>
        {numbered([
          <>Open your browser&apos;s <strong>⋮</strong> menu.</>,
          <>Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).</>,
          <>Confirm to add the Vetted.bb icon.</>,
        ])}
      </div>
    )
  } else {
    // Desktop, no install event available yet.
    body = (
      <p className="text-sm text-gray-600">In Chrome or Edge, click the install icon in the address bar, or open the <strong>⋮</strong> menu and choose <strong>Install Vetted.bb</strong>.</p>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900">Add to home screen</h2>
      <p className="text-sm text-gray-500 mt-0.5 mb-4">Install Vetted.bb for full-screen access, faster loading, and push notifications.</p>
      {body}
    </div>
  )
}
