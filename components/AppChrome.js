'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import WorkspaceSidebar from '@/components/WorkspaceSidebar'
import WorkspaceTopbar from '@/components/WorkspaceTopbar'

// Freelancer "workspace" routes get the left sidebar shell; everything else
// (public / marketplace / client) keeps the existing top nav + footer.
// Exact-match only: /clients is a workspace page but /clients/[id] is a public
// client profile, so we must not match by prefix here.
const WORKSPACE = ['/dashboard', '/inbox', '/quotes', '/calendar', '/clients', '/reviews', '/settings']

export default function AppChrome({ children }) {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const isWorkspace = WORKSPACE.includes(pathname)

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
