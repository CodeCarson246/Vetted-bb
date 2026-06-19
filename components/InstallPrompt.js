'use client'
import { useState, useEffect } from 'react'

// Mobile "Add to Home Screen" prompt.
// - Android/Chrome: captures beforeinstallprompt and offers a one-tap Install.
// - iOS Safari (no beforeinstallprompt): shows the manual Share → Add to Home
//   Screen hint (also the only way push works on iOS — installed PWA only).
// Hidden when already installed (standalone) or previously dismissed.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (standalone) return
    try { if (localStorage.getItem('vetted_install_dismissed')) return } catch { /* ignore */ }

    const ua = navigator.userAgent || ''
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua)
    if (!mobile) return

    if (/iPhone|iPad|iPod/i.test(ua)) {
      // iOS Safari only — Chrome/Firefox on iOS can't add to home screen well
      if (/Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua)) {
        setIsIOS(true)
        setShow(true)
      }
      return
    }

    const onBIP = (e) => { e.preventDefault(); setDeferred(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem('vetted_install_dismissed', '1') } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch { /* ignore */ }
    setDeferred(null)
    dismiss()
  }

  if (!show) return null

  return (
    <div
      style={{
        // sit above any bottom sticky action bar (e.g. the mobile profile CTA bar)
        position: 'fixed', bottom: 84, left: 12, right: 12, zIndex: 300,
        maxWidth: 460, margin: '0 auto',
        backgroundColor: '#00267F', color: '#fff', borderRadius: 14,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
      role="dialog"
      aria-label="Add Vetted.bb to your home screen"
    >
      <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>Add Vetted.bb to your home screen</p>
        <p style={{ fontSize: 12, margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
          {isIOS
            ? 'Tap the Share icon, then “Add to Home Screen” — needed for notifications too.'
            : 'Install the app for quick access and notifications.'}
        </p>
      </div>
      {isIOS ? (
        <button onClick={dismiss} style={{ flexShrink: 0, background: '#F9C000', color: '#00267F', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Got it
        </button>
      ) : (
        <button onClick={install} style={{ flexShrink: 0, background: '#F9C000', color: '#00267F', border: 'none', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 2 }}>×</button>
    </div>
  )
}
