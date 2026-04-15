'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type DesktopSidebarProps = {
  unreadActivityCount?: number
}

const navItems = [
  { href: '/feed', label: 'Home' },
  { href: '/explore', label: 'Search' },
  { href: '/create', label: 'Create' },
  { href: '/saved', label: 'Saved' },
  { href: '/activity', label: 'Activity' },
  { href: '/profile', label: 'Profile' },
]

function formatBadgeCount(value: number) {
  if (value > 99) return '99+'
  return String(value)
}

export function DesktopSidebar({
  unreadActivityCount = 0,
}: DesktopSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 shrink-0 border-r border-zinc-800/80 bg-black xl:block">
      <div className="sticky top-0 flex min-h-screen flex-col px-6 py-8">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            InstagramClone
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Recommendation-first social content MVP
          </p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href
            const showBadge = item.href === '/activity' && unreadActivityCount > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-base font-medium transition ${
                  active
                    ? 'bg-zinc-100 text-black'
                    : 'text-zinc-200 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span>{item.label}</span>

                {showBadge ? (
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      active
                        ? 'bg-black text-white'
                        : 'border border-white/10 bg-white text-black'
                    }`}
                  >
                    {formatBadgeCount(unreadActivityCount)}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto rounded-[28px] border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Product direction
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Instagram-like interface patterns with recommendation-first feed, discovery,
            creator identity, and retention loops.
          </p>
        </div>
      </div>
    </aside>
  )
}