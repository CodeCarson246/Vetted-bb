'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import WorkspaceSidebar from '@/components/WorkspaceSidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'
import DeactivationNotice from '@/components/DeactivationNotice'
import TermsUpdateNotice from '@/components/TermsUpdateNotice'

// Chrome is role-based: a logged-in FREELANCER gets the workspace sidebar on
// every page; clients and logged-out visitors get the marketplace top nav +
// footer. The freelancer flag is cached so returning freelancers render the
// sidebar immediately instead of flashing the top nav first.
export default function AppChrome({ children }) {
  const { user, loading } = useAuth()
  const [isFreelancer, setIsFreelancer] = useState(() => {
    if (typeof window === 'undefined') return null
    const c = localStorage.getItem('vetted_is_freelancer')
    return c === '1' ? true : c === '0' ? false : null
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setIsFreelancer(false)
      try { localStorage.setItem('vetted_is_freelancer', '0') } catch { /* ignore */ }
      return
    }
    let cancelled = false
    supabase.from('freelancers').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const v = !!data
        setIsFreelancer(v)
        try { localStorage.setItem('vetted_is_freelancer', v ? '1' : '0') } catch { /* ignore */ }
      })
    return () => { cancelled = true }
  }, [user, loading])

  if (isFreelancer) {
    return (
      <>
        <WorkspaceSidebar open={open} onClose={() => setOpen(false)} />
        <div className="md:ml-[244px] flex flex-col min-h-screen">
          <WorkspaceTopbar onMenuClick={() => setOpen(o => !o)} />
          <TermsUpdateNotice />
          <DeactivationNotice />
          {children}
        </div>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <TermsUpdateNotice />
      <DeactivationNotice />
      {children}
      <SiteFooter />
    </>
  )
}
