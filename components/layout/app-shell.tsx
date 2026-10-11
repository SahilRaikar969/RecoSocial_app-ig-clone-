'use client'

import { Suspense, useState, useTransition, type ReactNode, type FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bell, Camera, Mail, Search } from 'lucide-react'
import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { MobileNav } from './mobile-nav'
import { primaryNavigation, isActivePath } from './navigation-items'
import { ActivityNotificationDot } from '@/components/activity/activity-notification-dot'
import { SwipeCameraGateway } from '@/components/camera/swipe-camera-gateway'

function HeaderSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [pending, startTransition] = useTransition()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    startTransition(() => router.push(q ? '/explore?' + new URLSearchParams({ q }) : '/explore'))
  }
  return <form role="search" onSubmit={submit} aria-busy={pending} className="flex min-w-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 pl-3">
    <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-400" />
    <input aria-label="Search creators and posts" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white" />
    <button type="submit" className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-zinc-300 hover:text-white">{pending ? 'Searching…' : 'Search'}</button>
    <span role="status" className="sr-only">{pending ? 'Loading search results…' : ''}</span>
  </form>
}

function HeaderSearch() {
  const params = useSearchParams()
  const pathname = usePathname()
  const query = pathname === '/explore' ? params.get('q') || '' : ''
  return <HeaderSearchForm key={pathname + '?' + query} initialQuery={query} />
}

export function AppShell({ children }: { children: ReactNode; rightPanel?: ReactNode }) {
  const pathname = usePathname()
  return <div data-scroll-root="app" className="min-h-svh">
    <SwipeCameraGateway />
    <a href="#main-content" className="rs-skip">Skip to content</a>
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#111113]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-3 sm:px-5">
        <Link href="/feed" aria-label="RecoSocial home" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-base font-bold">r</span><span>RecoSocial</span>
        </Link>
        <div className="hidden w-full max-w-sm lg:block"><Suspense fallback={<Link href="/explore" className="rs-button">Search</Link>}><HeaderSearch /></Suspense></div>
        <div className="flex shrink-0 items-center">
          <Link href={`/camera?returnTo=${encodeURIComponent(pathname)}`} aria-label="Open camera" title="Camera" className="rs-icon-button"><Camera aria-hidden="true" className="h-5 w-5" /></Link>
          <Link href="/messages" aria-label="Messages" title="Messages" aria-current={isActivePath(pathname, '/messages') ? 'page' : undefined} className="rs-icon-button aria-[current=page]:bg-violet-500/15 aria-[current=page]:text-violet-200"><Mail aria-hidden="true" className="h-5 w-5" /></Link>
          <Link href="/activity" aria-label="Activity" title="Activity" aria-current={isActivePath(pathname, '/activity') ? 'page' : undefined} className="rs-icon-button aria-[current=page]:bg-violet-500/15 aria-[current=page]:text-violet-200"><Bell aria-hidden="true" className="h-5 w-5" /><ActivityNotificationDot className="absolute right-2 top-2 ring-2 ring-zinc-900" /></Link>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-[1440px] md:grid md:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] overflow-y-auto border-r border-zinc-800 px-2 py-5 md:block xl:px-4">
        <nav aria-label="Primary" className="space-y-2">
          {primaryNavigation.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href)
            return <Link key={href} href={href} title={label} aria-label={label} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center justify-center gap-3 rounded-lg px-3 text-sm font-semibold xl:justify-start ${active ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-300 hover:bg-zinc-800'}`}><Icon aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="hidden xl:inline">{label}</span></Link>
          })}
        </nav>
      </aside>
      <main id="main-content" tabIndex={-1} className="min-w-0 px-3 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-8 lg:px-8">{children}</main>
    </div>
    <MobileNav />
  </div>
}
