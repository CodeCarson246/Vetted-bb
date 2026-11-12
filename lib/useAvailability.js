'use client'
import { useEffect, useState } from 'react'

// One fetch of a professional's public booking availability, shared by
// everything on the profile that needs it (the booking panel, and the
// "Available / Booked until" line on each rental item), so the page asks
// once however many places read the answer.
const inflight = new Map()

function load(freelancerId) {
  if (!inflight.has(freelancerId)) {
    inflight.set(freelancerId, fetch(`/api/availability?freelancer_id=${freelancerId}`)
      .then(r => r.json())
      .catch(() => ({ enabled: false })))
  }
  return inflight.get(freelancerId)
}

/** null while loading, then the API payload ({ enabled: false } when off). */
export function useAvailability(freelancerId) {
  const [state, setState] = useState({ id: null, config: null })

  useEffect(() => {
    if (!freelancerId) return
    let cancelled = false
    const apply = () => load(freelancerId).then(c => { if (!cancelled) setState({ id: freelancerId, config: c }) })
    apply()
    // After a request is sent, or a date turns out to be gone, re-read.
    // refreshAvailability() has already dropped the saved answer, so every
    // listener shares the one new request.
    const onRefresh = () => apply()
    window.addEventListener('vetted:availability-refresh', onRefresh)
    return () => { cancelled = true; window.removeEventListener('vetted:availability-refresh', onRefresh) }
  }, [freelancerId])

  return state.id === freelancerId ? state.config : null
}

export function refreshAvailability() {
  inflight.clear()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('vetted:availability-refresh'))
}

/** Ask the booking panel to open on one item (from an item's own card). */
export function openBookingFor(serviceId) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vetted:book-service', { detail: { serviceId } }))
}
