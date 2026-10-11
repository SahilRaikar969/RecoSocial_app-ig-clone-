import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { markNotificationsRead } from '@/actions/notifications'
import { ActivityList } from '@/components/activity/activity-list'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { PageShell } from '@/components/ui/page-shell'

import { getDevSession } from '@/lib/auth/get-dev-session'
import { getNotificationsPageData } from '@/lib/db/queries/notifications'

export const metadata = { title: 'Activity' }

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

  return 'Activity could not be updated. Try again.'
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const filter = normalizeFilter(resolvedSearchParams?.filter)
  const { profileId } = await getDevSession()

  const { notifications } = await getNotificationsPageData(profileId, filter)
  const errorMessage = getErrorMessage(resolvedSearchParams?.error)
  const feedback =
    resolvedSearchParams?.read === '1' ? 'Notifications marked as read.' : ''

  return <PageShell maxWidth="4xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Activity</h1><form action={markNotificationsRead}><button type="submit" className="rs-button">Mark all as read</button></form></header>
    {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
    {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
    <nav aria-label="Activity filters" className="flex flex-wrap gap-2">{FILTERS.map(item => <Link key={item.key} href={getFilterHref(item.key)} aria-current={item.key === filter ? 'page' : undefined} className={`rs-button ${item.key === filter ? 'border-violet-400 bg-violet-500/15 text-violet-100' : ''}`}>{item.label}</Link>)}</nav>
    <ActivityList filter={filter} notifications={notifications} />
  </PageShell>
}
