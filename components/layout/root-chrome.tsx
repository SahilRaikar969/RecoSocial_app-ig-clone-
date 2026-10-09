'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { UnreadNotificationsProvider } from '@/components/activity/unread-notifications-provider'

type RootChromeProps = {
  children: ReactNode
}

export function RootChrome({ children }: RootChromeProps) {
  const pathname = usePathname()

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')

  const isLandingRoute = pathname === '/'
  const isReelRoute = pathname.startsWith('/reel/')
  const isStoryViewerRoute = /^\/stories\/[^/]+$/.test(pathname)
  const isCameraRoute = pathname.startsWith('/camera')

  if (
    isAuthRoute ||
    isLandingRoute ||
    isReelRoute ||
    isStoryViewerRoute ||
    isCameraRoute
  ) {
    return <>{children}</>
  }

  return <UnreadNotificationsProvider><AppShell>{children}</AppShell></UnreadNotificationsProvider>
}