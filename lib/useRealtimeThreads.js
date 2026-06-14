'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Live conversation updates via Supabase Realtime.
//
// Subscribes to inserts on messages/message_replies and any change on quotes;
// Row-Level Security scopes the events to the current user's own rows. Any
// event calls onChange (debounced) and the page then REFETCHES — we never
// trust a partial realtime payload, which keeps ordering/dedupe correct and
// works even if replica identity is minimal. Also refreshes when the tab
// regains focus, since realtime can drop while backgrounded. One channel per
// mount, torn down on unmount.
//
// Requires the tables to be in the `supabase_realtime` publication
// (see SUPABASE_SQL.sql section 11). If realtime isn't enabled the page still
// updates via its slower safety-net poll, just not instantly.
export function useRealtimeThreads(enabled, onChange) {
  const cbRef = useRef(onChange)
  cbRef.current = onChange

  useEffect(() => {
    if (!enabled) return
    let timer = null
    const ping = () => {
      clearTimeout(timer)
      timer = setTimeout(() => cbRef.current?.(), 300)
    }

    const channel = supabase
      .channel(`threads-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_replies' }, ping)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, ping)
      .subscribe()

    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [enabled])
}
