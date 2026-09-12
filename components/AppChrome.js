'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { isOrganisationUser } from '@/lib/organisations'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import WorkspaceSidebar from '@/components/WorkspaceSidebar'
import OrganisationSidebar from '@/components/OrganisationSidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'
import DeactivationNotice from '@/components/DeactivationNotice'
import TermsUpdateNotice from '@/components/TermsUpdateNotice'

// Chrome is role-based:
//  - a logged-in FREELANCER gets the workspace sidebar on every page;
//  - a logged-in ORGANISATION user gets the organisation sidebar;
//  - clients and logged-out visitors get the marketplace top nav + footer.
// Both workspace flags are cached so returning users render the right
// chrome immediately instead of flashing the top nav first.
export default function AppChrome({ children }) {
  const { user, loading } = useAuth()
  const [isFreelancer, setIsFreelancer] = useState(() => {
    if (typeof window === 'undefined') return null
    const c = localStorage.getItem('vetted_is_freelancer')
    return c === '1' ? true : c === '0' ? false : null
  })
  const [isOrg, setIsOrg] = useState(() => {
    if (typeof window === 'undefined') return null
    const c = localStorage.getItem('vetted_is_org')
    return c === '1' ? true : c === '0' ? false : null
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    /* eslint-disable react-hooks/set-state-in-effect -- mirrors the session (an external system) into chrome flags once auth resolves */
    if (!user) {
      setIsFreelancer(false)
      setIsOrg(false)
      try { localStorage.setItem('vetted_is_freelancer', '0'); localStorage.setItem('vetted_is_org', '0') } catch { /* ignore */ }
      return
    }
    // The organisation role lives in session metadata: no query needed.
    const org = isOrganisationUser(user)
    setIsOrg(org)
    try { localStorage.setItem('vetted_is_org', org ? '1' : '0') } catch { /* ignore */ }
    if (org) {
      setIsFreelancer(false)
      return
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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

  if (isOrg) {
    return (
      <>
        <OrganisationSidebar open={open} onClose={() => setOpen(false)} />
        <div className="md:ml-[244px] flex flex-col min-h-screen">
          <WorkspaceTopbar onMenuClick={() => setOpen(o => !o)} />
          <TermsUpdateNotice />
          <DeactivationNotice />
          {children}
        </div>
      </>
    )
  }

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
