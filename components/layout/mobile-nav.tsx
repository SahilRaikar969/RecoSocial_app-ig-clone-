'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Heart, Home, Mail, PlusSquare, Settings, User } from 'lucide-react'

const navItems = [
  { href: '/feed', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/messages', label: 'Inbox', icon: Mail },
  { href: '/create', label: 'Create', icon: PlusSquare },
  { href: '/activity', label: 'Activity', icon: Heart },
  { href: '/profile', label: 'Profile', icon: User },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/feed') {
    return pathname === '/' || pathname.startsWith('/feed')
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileNav() {
  const pathname = usePathname()

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')

  const isReelRoute = pathname.startsWith('/reel/')
  const isStoryViewerRoute = /^\/stories\/[^/]+$/.test(pathname)

  if (isAuthRoute || isReelRoute || isStoryViewerRoute) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/90 bg-black/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActivePath(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2"
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  active
                    ? 'border-violet-400/20 bg-[linear-gradient(180deg,rgba(32,32,40,0.96),rgba(16,16,22,0.96))] text-white shadow-[0_8px_20px_rgba(120,119,255,0.10)]'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>

              <span
                className={`truncate text-[10px] font-medium ${
                  active ? 'text-white' : 'text-zinc-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>

      <Link
        href="/settings"
        className="absolute right-3 top-[-48px] inline-flex h-11 w-11 items-center justify-center rounded-full border border-violet-400/20 bg-[linear-gradient(180deg,rgba(32,32,40,0.96),rgba(16,16,22,0.96))] text-white shadow-[0_8px_20px_rgba(120,119,255,0.14)]"
        aria-label="Open settings"
      >
        <Settings className="h-4.5 w-4.5" />
      </Link>
    </nav>
  )
}