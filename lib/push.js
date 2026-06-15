'use client'
import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

/** Current state: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' */
export async function getPushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub ? 'subscribed' : 'unsubscribed'
}

/**
 * Ask permission, subscribe the browser, and store the subscription for
 * this user. Returns 'subscribed' | 'denied' | 'error' | 'unsupported'.
 */
export async function enablePush(userId) {
  if (!pushSupported()) return 'unsupported'
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  // Missing public VAPID key in the build → can't subscribe. This is the
  // usual cause of "errors before the permission prompt even shows".
  if (!vapidKey) {
    console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from the build')
    return 'not-configured'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        subscription: sub.toJSON(),
      },
      { onConflict: 'endpoint' },
    )
    if (error) {
      console.error('[push] failed to store subscription:', error)
      return 'error'
    }
    return 'subscribed'
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return 'error'
  }
}

/** Unsubscribe this browser and remove the stored subscription. */
export async function disablePush() {
  if (!pushSupported()) return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    return 'unsubscribed'
  } catch (err) {
    console.error('[push] unsubscribe failed:', err)
    return 'error'
  }
}
