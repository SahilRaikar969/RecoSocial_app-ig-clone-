'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Heart, Home, PlusSquare, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { ActivityNotificationDot } from '@/components/activity/activity-notification-dot'

const navItems = [
  { href: '/feed', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
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

  if (isAuthRoute || isReelRoute) return null

  return (
    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/90 bg-black/75 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-2xl md:hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.14),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_32%)]" />

      <div className="pointer-events-auto relative mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActivePath(pathname, item.href)
          const isActivity = item.href === '/activity'

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2"
            >
              <motion.div
                whileTap={{ scale: 0.92 }}
                animate={active ? { y: -2, scale: 1.04 } : { y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${
                  active
                    ? 'border-violet-400/20 bg-[linear-gradient(180deg,rgba(38,38,48,0.96),rgba(18,18,24,0.96))] text-white shadow-[0_14px_40px_rgba(120,119,255,0.2)]'
                    : 'border-zinc-800 bg-zinc-950/90 text-zinc-400'
                }`}
              >
                {active ? (
                  <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(120,119,255,0.18),transparent_70%)]" />
                ) : null}

                {isActivity && !active ? (
                  <ActivityNotificationDot className="absolute right-2 top-2 z-10" />
                ) : null}

                <Icon className="relative h-5 w-5" />
              </motion.div>

              <span
                className={`truncate text-[11px] font-medium ${
                  active ? 'text-white' : 'text-zinc-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}