'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  Bookmark,
  Compass,
  Heart,
  Home,
  PlusSquare,
  Search,
  Sparkles,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { MobileNav } from '@/components/layout/mobile-nav'
import { ActivityNotificationDot } from '@/components/activity/activity-notification-dot'

type AppShellProps = {
  children: ReactNode
  rightPanel?: ReactNode
}

const navItems = [
  { href: '/feed', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/activity', label: 'Activity', icon: Heart },
  { href: '/profile', label: 'Profile', icon: User },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/feed') {
    return pathname === '/' || pathname.startsWith('/feed')
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function getRouteContext(pathname: string) {
  if (pathname.startsWith('/feed')) {
    return {
      label: 'Home feed',
      description: 'Personalized ranking from creators, interests, and discovery.',
    }
  }

  if (pathname.startsWith('/explore')) {
    return {
      label: 'Explore',
      description: 'Search creators, categories, and wider discovery loops.',
    }
  }

  if (pathname.startsWith('/saved')) {
    return {
      label: 'Saved',
      description: 'Your kept posts, ready to revisit without losing momentum.',
    }
  }

  if (pathname.startsWith('/activity')) {
    return {
      label: 'Activity',
      description: 'Likes, comments, follows, and creator visits routed back into the product.',
    }
  }

  if (pathname.startsWith('/profile')) {
    return {
      label: 'Profile',
      description: 'Your creator surface, posts, and network identity.',
    }
  }

  if (pathname.startsWith('/create')) {
    return {
      label: 'Create',
      description: 'Publish image and video posts into the main social loop.',
    }
  }

  if (pathname.startsWith('/post/')) {
    return {
      label: 'Post',
      description: 'Focused post view with interaction and conversation detail.',
    }
  }

  if (pathname.startsWith('/onboarding')) {
    return {
      label: 'Onboarding',
      description: 'Seed the recommendation graph with stronger interests.',
    }
  }

  return {
    label: 'RecoSocial',
    description: 'Premium social discovery.',
  }
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  const isActivity = href === '/activity'

  return (
    <motion.div whileHover={{ x: 3, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16 }}>
      <Link
        href={href}
        className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-medium transition ${
          active
            ? 'border-violet-400/20 bg-[linear-gradient(180deg,rgba(38,38,48,0.96),rgba(18,18,24,0.96))] text-white shadow-[0_14px_40px_rgba(120,119,255,0.16)]'
            : 'border-transparent text-zinc-400 hover:border-zinc-700/80 hover:bg-zinc-950/90 hover:text-white'
        }`}
      >
        {active ? (
          <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-[linear-gradient(180deg,rgba(120,119,255,0.9),rgba(236,72,153,0.72))]" />
        ) : null}

        <div className="relative">
          {!active && isActivity ? (
            <ActivityNotificationDot className="absolute -right-1 -top-0.5 z-10" />
          ) : null}
          <Icon className={`h-5 w-5 transition ${active ? 'text-white' : 'group-hover:text-zinc-100'}`} />
        </div>

        <span>{label}</span>
      </Link>
    </motion.div>
  )
}

function DefaultRightPanel({ pathname }: { pathname: string }) {
  const context = getRouteContext(pathname)

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_24%)]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            <Sparkles className="h-3.5 w-3.5" />
            In product
          </div>

          <h3 className="mt-4 text-base font-semibold text-white">{context.label}</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-300">{context.description}</p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-zinc-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Product feel
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Feed, explore, activity, and saved stay on one darker shell so the app feels continuous instead of page-by-page.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-4 py-4 transition hover:-translate-y-0.5 hover:border-zinc-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Return loops
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Stronger routing keeps users moving back into creators, posts, reels, and saved surfaces.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(120,119,255,0.08),transparent_30%)]" />

        <div className="relative">
          <h3 className="text-sm font-semibold text-white">Quick routes</h3>

          <div className="mt-4 grid gap-3">
            <Link
              href="/create"
              className="rounded-3xl border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:text-white"
            >
              Publish a new post
            </Link>

            <Link
              href="/saved"
              className="rounded-3xl border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:text-white"
            >
              Re-open saved content
            </Link>

            <Link
              href="/activity"
              className="relative rounded-3xl border border-zinc-800 bg-zinc-950/85 px-4 py-4 text-sm text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:text-white"
            >
              <span className="absolute right-4 top-4">
                <ActivityNotificationDot />
              </span>
              Check notifications
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export function AppShell({ children, rightPanel }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
 

  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    if (pathname.startsWith('/explore')) {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        setSearchValue(params.get('q')?.trim() || '')
      }
      return
    }

    setSearchValue('')
  }, [pathname])

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')

  const isReelRoute = pathname.startsWith('/reel/')

  const isCreateRoute = pathname.startsWith('/create')
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isProfileEditRoute = pathname.startsWith('/profile/edit')
  const isPostEditRoute =
    pathname.startsWith('/post/') && pathname.endsWith('/edit')
  const isPostDetailRoute =
    pathname.startsWith('/post/') && !pathname.endsWith('/edit')

  const isProfileSurfaceRoute =
    pathname === '/profile' ||
    pathname === '/profile/followers' ||
    pathname === '/profile/following' ||
    /^\/profile\/[^/]+$/.test(pathname) ||
    /^\/profile\/[^/]+\/followers$/.test(pathname) ||
    /^\/profile\/[^/]+\/following$/.test(pathname)

  const isEditorLikeRoute =
    isCreateRoute || isOnboardingRoute || isProfileEditRoute || isPostEditRoute

  const hideRightPanel =
    isPostDetailRoute || isEditorLikeRoute || isProfileSurfaceRoute

  const resolvedRightPanel = rightPanel ?? <DefaultRightPanel pathname={pathname} />

  const shellGridClass = useMemo(() => {
    if (isProfileSurfaceRoute) {
      return 'xl:grid-cols-[220px_minmax(0,1020px)] xl:justify-center'
    }

    if (isPostDetailRoute) {
      return 'xl:grid-cols-[220px_minmax(0,1080px)] xl:justify-center'
    }

    if (isEditorLikeRoute) {
      return 'xl:grid-cols-[220px_minmax(0,1fr)]'
    }

    return 'xl:grid-cols-[220px_minmax(0,820px)_320px] xl:justify-center'
  }, [isEditorLikeRoute, isPostDetailRoute, isProfileSurfaceRoute])

  const searchPlaceholder = useMemo(() => {
    if (pathname.startsWith('/activity')) return 'Search creators or captions'
    if (pathname.startsWith('/saved')) return 'Search creators, captions, topics...'
    if (pathname.startsWith('/profile')) return 'Search creators or posts'
    return 'Search creators, captions, topics...'
  }, [pathname])

  const routeContext = useMemo(() => getRouteContext(pathname), [pathname])

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = searchValue.trim()

    if (!trimmed) {
      router.push('/explore')
      return
    }

    router.push(`/explore?${new URLSearchParams({ q: trimmed }).toString()}`)
  }

  if (isAuthRoute || isReelRoute) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div
      data-scroll-root="app"
      className="relative min-h-screen bg-transparent text-white"
    >
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
      <div className="pointer-events-none fixed left-[8%] top-32 z-0 h-72 w-72 rounded-full bg-violet-500/10 blur-[110px]" />
      <div className="pointer-events-none fixed right-[10%] top-48 z-0 h-72 w-72 rounded-full bg-pink-500/8 blur-[120px]" />

      <header className="sticky top-0 z-40 border-b border-zinc-900/90 bg-black/68 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1520px] items-center gap-3 px-4 md:px-6">
          <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.16 }}>
            <Link
              href="/feed"
              className="bg-[linear-gradient(90deg,#ffffff_0%,#d8d8ff_50%,#ffffff_100%)] bg-clip-text text-lg font-black tracking-tight text-transparent md:text-xl"
            >
              RecoSocial
            </Link>
          </motion.div>

          <div className="hidden items-center md:flex">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 shadow-[0_10px_30px_rgba(120,119,255,0.08)]">
              {routeContext.label}
            </div>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="hidden min-w-0 flex-1 items-center md:flex"
          >
            <motion.div className="flex w-full items-center gap-3 rounded-full border border-zinc-800/90 bg-zinc-950/85 px-4 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.24)] transition focus-within:border-violet-500/30 focus-within:bg-zinc-950 focus-within:shadow-[0_0_0_1px_rgba(120,119,255,0.12),0_18px_45px_rgba(120,119,255,0.08)]">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />

              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />

              {searchValue.trim() ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="rounded-full bg-[linear-gradient(90deg,#ffffff_0%,#f2f2ff_100%)] px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90"
                >
                  Search
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
                >
                  Explore
                </motion.button>
              )}
            </motion.div>
          </form>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link
              href="/explore"
              className="rounded-full border border-zinc-800 bg-zinc-950/85 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white md:hidden"
            >
              Search
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  href="/activity"
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                    isActivePath(pathname, '/activity')
                      ? 'border-violet-400/20 bg-[linear-gradient(180deg,rgba(38,38,48,0.96),rgba(18,18,24,0.96))] text-white shadow-[0_12px_32px_rgba(120,119,255,0.16)]'
                      : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Activity
                </Link>
              </motion.div>

              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  href="/create"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    pathname.startsWith('/create')
                      ? 'border border-violet-400/20 bg-[linear-gradient(180deg,rgba(38,38,48,0.96),rgba(18,18,24,0.96))] text-white shadow-[0_12px_32px_rgba(120,119,255,0.16)]'
                      : 'bg-[linear-gradient(90deg,#ffffff_0%,#f3f3ff_100%)] text-black hover:opacity-90'
                  }`}
                >
                  Create
                </Link>
              </motion.div>

              <motion.div whileTap={{ scale: 0.94 }}>
                <Link
                  href="/activity"
                  className={`relative inline-flex rounded-full border p-2 transition ${
                    isActivePath(pathname, '/activity')
                      ? 'border-violet-400/20 bg-[linear-gradient(180deg,rgba(38,38,48,0.96),rgba(18,18,24,0.96))] text-white shadow-[0_12px_32px_rgba(120,119,255,0.16)]'
                      : 'border-zinc-800 bg-zinc-950/85 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                  aria-label="Open activity"
                >
                  {!isActivePath(pathname, '/activity') ? (
                    <ActivityNotificationDot className="absolute right-1.5 top-1.5 z-10" />
                  ) : null}
                  <Bell className="h-5 w-5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1520px] px-4 pb-24 pt-6 md:px-6 md:pb-6">
        <div className={`grid items-start gap-6 ${shellGridClass}`}>
          <aside className="hidden xl:block">
            <div className="h-[1px] w-[220px]" />
          </aside>

          <main className="min-w-0">{children}</main>

          {!hideRightPanel ? (
            <aside className="hidden xl:block">
              <div className="sticky top-24">{resolvedRightPanel}</div>
            </aside>
          ) : null}
        </div>
      </div>

      <div className="fixed left-[max(24px,calc((100vw-1520px)/2+24px))] top-24 z-30 hidden w-[220px] xl:block">
        <div className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_26%)]" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Navigation
            </p>

            <nav className="mt-6 space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActivePath(pathname, item.href)}
                />
              ))}

              <motion.div whileHover={{ x: 3, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16 }}>
                <Link
                  href="/create"
                  className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    pathname.startsWith('/create')
                      ? 'border-violet-400/20 bg-[linear-gradient(180deg,rgba(38,38,48,0.96),rgba(18,18,24,0.96))] text-white shadow-[0_14px_40px_rgba(120,119,255,0.16)]'
                      : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-950/90 hover:text-white'
                  }`}
                >
                  {pathname.startsWith('/create') ? (
                    <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-[linear-gradient(180deg,rgba(120,119,255,0.9),rgba(236,72,153,0.72))]" />
                  ) : null}
                  <PlusSquare className="h-5 w-5" />
                  <span>Create</span>
                </Link>
              </motion.div>
            </nav>
          </div>
        </div>
      </div>

      <MobileNav />
    </div>
  )
}