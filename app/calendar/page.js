'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)

  // Calendar is a freelancer-workspace page; send non-freelancers home.
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    supabase.from('freelancers').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) { router.replace('/'); return }
        setChecking(false)
      })
    return () => { cancelled = true }
  }, [user, authLoading, router])

  if (authLoading || checking) {
    return (
      <main className="min-h-screen page-bg flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Calendar &amp; availability</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your jobs and let clients see when you&apos;re available.</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center mt-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
            <svg width="26" height="26" fill="none" stroke="#00267F" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 mb-1">Calendar is coming next</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Private scheduling — month, week and day views of your jobs and appointments, with today&apos;s schedule and upcoming bookings — is the next build. Public client booking follows after that.
          </p>
        </div>
      </div>
    </main>
  )
}
