import Link from 'next/link'
import { markNotificationsRead } from '@/actions/notifications'
import { ActivityList } from '@/components/activity/activity-list'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getNotificationsPageData } from '@/lib/db/queries/notifications'

type NotificationFilter = 'all' | 'unread' | 'follow' | 'like' | 'comment'

type ActivityPageProps = {
  searchParams?: Promise<{
    filter?: string
    error?: string
    read?: string
  }>
}

const FILTERS: Array<{
  key: NotificationFilter
  label: string
}> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'follow', label: 'Follows' },
  { key: 'like', label: 'Likes' },
  { key: 'comment', label: 'Comments' },
]

function normalizeFilter(value?: string): NotificationFilter {
  switch (String(value || '').toLowerCase()) {
    case 'unread':
      return 'unread'
    case 'follow':
      return 'follow'
    case 'like':
      return 'like'
    case 'comment':
      return 'comment'
    default:
      return 'all'
  }
}

function getFilterHref(filter: NotificationFilter) {
  if (filter === 'all') return '/activity'
  return `/activity?filter=${filter}`
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()

  if (!error) return ''

  if (error === 'missing_notification_id') {
    return 'Missing notification id.'
  }

  return `Action failed: ${decodeURIComponent(error)}`
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const filter = normalizeFilter(resolvedSearchParams?.filter)
  const { profileId } = await getDevSession()

  const { notifications, summary } = await getNotificationsPageData(profileId, filter)
  const errorMessage = getErrorMessage(resolvedSearchParams?.error)
  const feedback =
    resolvedSearchParams?.read === '1' ? 'Notifications marked as read.' : ''

  return (
    <PageShell maxWidth="6xl">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <div className="space-y-6">
        <SurfaceHero
          eyebrow="Retention"
          title="Activity"
          description="Track follows, likes, and comments in one clearer notification surface with stronger routing back into creators and posts."
          actions={[
            { href: '/feed', label: 'Back to feed', variant: 'secondary' },
            { href: '/explore', label: 'Explore creators', variant: 'secondary' },
          ]}
          stats={[
            {
              label: 'Unread',
              value: String(summary.unread),
              helper: 'new notifications waiting for review',
            },
            {
              label: 'Engagement',
              value: String(summary.like + summary.comment),
              helper: 'likes and comments combined',
            },
            {
              label: 'Follows',
              value: String(summary.follow),
              helper: 'creator relationship events',
            },
          ]}
        />

        <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_30%)]" />

          <div className="relative border-b border-zinc-800/80 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200">
                  Notification filters
                </div>

                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                  Focus the activity stream
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                  Switch between unread items, relationship updates, and post engagement without leaving the main retention route.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
                >
                  Open profile
                </Link>

                <form action={markNotificationsRead}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm font-semibold !text-black transition hover:-translate-y-0.5 hover:opacity-90"
                  >
                    Mark all as read
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="relative px-5 py-5 sm:px-6">
            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              <div className="flex min-w-max gap-2">
                {FILTERS.map((item) => {
                  const active = item.key === filter

                  return (
                    <Link
                      key={item.key}
                      href={getFilterHref(item.key)}
                      className={`inline-flex min-w-[84px] items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                        active
                          ? 'border-white/80 bg-white !text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)]'
                          : 'border-zinc-700 bg-zinc-950/90 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Total
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {summary.total}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  All notifications in the current activity view.
                </p>
              </div>

              <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Unread
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {summary.unread}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Items still waiting for review.
                </p>
              </div>

              <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Likes + comments
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {summary.like + summary.comment}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Post response signals across the app.
                </p>
              </div>

              <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Follow events
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {summary.follow}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Relationship changes in your creator graph.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ActivityList filter={filter} notifications={notifications} />
      </div>
    </PageShell>
  )
}