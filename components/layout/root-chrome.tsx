'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'

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

  if (isAuthRoute || isLandingRoute) {
    return <>{children}</>
  }

  return <AppShell>{children}</AppShell>
}