// Shared PWA install state. The listener attaches as soon as this module is
// first imported on the client — InstallPrompt (mounted app-wide in layout.js)
// imports it, so the beforeinstallprompt event is captured on every page load,
// early enough for both the auto banner and the Settings "Install" button to
// use it. Chrome fires beforeinstallprompt once; whoever calls promptInstall()
// first consumes it.
let deferredPrompt = null
const subscribers = new Set()
function emit() { subscribers.forEach((fn) => fn()) }

if (typeof window !== 'undefined' && !window.__vettedInstallInit) {
  window.__vettedInstallInit = true
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop Chrome's default mini-infobar so we can offer install on our terms.
    e.preventDefault()
    deferredPrompt = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })
}

// Subscribe to install-availability changes. Returns an unsubscribe function.
export function subscribeInstall(cb) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

// True when Chrome has handed us an installable event we can still fire.
export function canInstall() {
  return deferredPrompt !== null
}

// Fire the native install prompt (Android / desktop Chromium). Resolves to
// 'accepted', 'dismissed', or 'unavailable'.
export async function promptInstall() {
  const e = deferredPrompt
  if (!e) return 'unavailable'
  e.prompt()
  let outcome = 'dismissed'
  try { const res = await e.userChoice; outcome = res?.outcome || 'dismissed' } catch { /* ignore */ }
  deferredPrompt = null
  emit()
  return outcome
}

// Already running as an installed PWA?
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// Best-effort platform read for choosing which install instructions to show.
export function detectPlatform() {
  if (typeof navigator === 'undefined') return { iOS: false, iOSSafari: false, android: false, inAppBrowser: false }
  const ua = navigator.userAgent || ''
  // iPadOS 13+ reports a desktop Safari UA, so also treat touch-capable Macs as iOS.
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  // In-app browsers (WhatsApp, Instagram, Facebook, etc.) can't add to home screen.
  const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|Twitter|TikTok|GSA/i.test(ua)
  const iOSSafari = iOS && !inAppBrowser && !/CriOS|FxiOS|EdgiOS/i.test(ua)
  const android = /Android/i.test(ua)
  return { iOS, iOSSafari, android, inAppBrowser }
}
