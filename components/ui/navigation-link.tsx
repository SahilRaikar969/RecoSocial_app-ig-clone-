'use client'

import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'

function NavigationStatus() {
  const { pending } = useLinkStatus()

  return (
    <span role="status" aria-live="polite" className="pointer-events-none absolute inset-x-2 bottom-0.5" data-navigation-pending={pending || undefined}>
      <span className="sr-only">{pending ? 'Loading page…' : ''}</span>
      <span aria-hidden="true" className={`block h-0.5 rounded-full bg-violet-400 transition-opacity ${pending ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-0'}`} />
    </span>
  )
}

// Keep Next's default partial prefetch and native modified-click behavior.
// The hint covers a cold/unfinished prefetch without adding a second router.
export function NavigationLink({ children, className = '', ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`relative ${className}`}>
      {children}
      <NavigationStatus />
    </Link>
  )
}
