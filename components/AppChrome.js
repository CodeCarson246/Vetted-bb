'use client'
import { useState, useEffect, useLayoutEffect } from 'react'
import { getMyFreelancer } from '@/lib/myFreelancer'
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
  // Both flags start null on the server AND on the first client render, so
  // the hydrated tree matches the server's. The cached values are applied in
  // a layout effect, which runs after hydration but before the browser
  // paints, so a returning freelancer still never sees the wrong nav flash.
  // (Reading localStorage inside the initializer used to make the client
  // render a different tree from the server, which failed hydration and
  // forced React to rebuild the whole page.)
  const [isFreelancer, setIsFreelancer] = useState(null)
  const [isOrg, setIsOrg] = useState(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- applies the cached chrome choice before first paint; there is no external event to subscribe to */
    try {
      const f = localStorage.getItem('vetted_is_freelancer')
      const g = localStorage.getItem('vetted_is_org')
      if (g === '1') setIsOrg(true)
      else if (f === '1') setIsFreelancer(true)
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

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
    // Shared with the sidebar and dashboard: one request between them.
    getMyFreelancer(user.id)
      .then(data => {
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
