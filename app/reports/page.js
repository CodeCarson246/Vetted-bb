'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { todayKeyBarbados } from '@/lib/rentals'
import IncomeSummary from '@/components/IncomeSummary'

// Rows of a table that may not exist yet (a section of SQL not run): none.
async function rowsOrNone(query) {
  const { data, error } = await query
  return error ? [] : (data || [])
}

// Reports: the professional's year-end income summary. Worked out from their
// own quotes, invoices, payments and expenses; nothing new is stored.
export default function ReportsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [thisYear, setThisYear] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    ;(async () => {
      const { data: f } = await supabase.from('freelancers').select('id').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      if (!f) { router.replace('/'); return }
      const [quotes, expenses] = await Promise.all([
        rowsOrNone(supabase.from('quotes').select('*').eq('freelancer_id', f.id)),
        // Amounts and dates only: this page shows totals, not what was bought.
        rowsOrNone(supabase.from('job_expenses').select('amount, incurred_on').eq('freelancer_id', f.id)),
      ])
      const invoiced = quotes.filter(q => q.invoice_number).map(q => q.id)
      const payments = invoiced.length
        ? await rowsOrNone(supabase.from('invoice_payments').select('quote_id, amount, received_on').in('quote_id', invoiced))
        : []
      if (cancelled) return
      setThisYear(todayKeyBarbados().slice(0, 4))
      setData({ quotes, payments, expenses })
    })()
    return () => { cancelled = true }
  }, [user, authLoading, router])

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Your year-end income summary, from your quotes, invoices, payments and expenses on Vetted.bb.</p>
        </div>
        <IncomeSummary data={data} thisYear={thisYear} side="professional" />
      </div>
    </main>
  )
}
