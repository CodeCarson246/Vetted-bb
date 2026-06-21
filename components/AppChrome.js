'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import WorkspaceSidebar from '@/components/WorkspaceSidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'

// Freelancer "workspace" routes get the left sidebar shell; everything else
// (public / marketplace / client) keeps the existing top nav + footer.
const WORKSPACE = ['/dashboard', '/inbox', '/quotes', '/calendar', '/settings']

export default function AppChrome({ children }) {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const isWorkspace = WORKSPACE.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isWorkspace) {
    return (
      <>
        <WorkspaceSidebar open={open} onClose={() => setOpen(false)} />
        <div className="md:ml-[244px] flex flex-col min-h-screen">
          <WorkspaceTopbar onMenuClick={() => setOpen(o => !o)} />
          {children}
        </div>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  )
}
