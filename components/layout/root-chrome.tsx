'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { UnreadNotificationsProvider } from '@/components/activity/unread-notifications-provider'

type RootChromeProps = {
  children: ReactNode
  initialViewerId: string | null
}

export function RootChrome({ children, initialViewerId }: RootChromeProps) {
  const pathname = usePathname()

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')

  const isLandingRoute = pathname === '/'
  const isReelRoute = pathname.startsWith('/reel/')
  const isStoryViewerRoute = pathname !== '/stories/create' && /^\/stories\/[^/]+$/.test(pathname)
  const isCameraRoute = pathname.startsWith('/camera')

  if (isAuthRoute || isLandingRoute) return <>{children}</>

  const isFullscreenRoute = isReelRoute || isStoryViewerRoute || isCameraRoute
  // Keep the same verified session owner on fullscreen routes: Stories, Reels
  // and Camera also hold viewer-specific state even without navigation chrome.
  return <UnreadNotificationsProvider initialViewerId={initialViewerId}>{isFullscreenRoute ? children : <AppShell>{children}</AppShell>}</UnreadNotificationsProvider>
}
