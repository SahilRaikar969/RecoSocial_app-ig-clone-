import Link from 'next/link'
import { Bell, CheckCircle2, MessageCircle, Sparkles, UserPlus } from 'lucide-react'
import { ActivityItem } from '@/components/activity/activity-item'

type NotificationFilter = 'all' | 'unread' | 'follow' | 'like' | 'comment'

type NotificationItem = {
  id: string
  type: 'comment' | 'follow' | 'like' | 'profile_view'
  created_at: string
  read_at?: string | null
  actor_profile_id?: string | null
  actor?: {
    id?: string | null
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
  post?: {
    id?: string | null
    caption?: string | null
    media_type?: string | null
    media_path?: string | null
    thumbnail_path?: string | null
  } | null
  comment?: {
    id?: string | null
    body?: string | null
  } | null
}

type ActivityListProps = {
  filter: NotificationFilter
  notifications: NotificationItem[]
}

function getEmptyCopy(filter: NotificationFilter) {
  switch (filter) {
    case 'unread':
      return {
        badge: 'All clear',
        title: 'No unread notifications',
        body: 'You are caught up. New follows, likes, and comments will appear here.',
      }
    case 'follow':
      return {
        badge: 'Relationship loop',
        title: 'No follow activity yet',
        body: 'When creators follow you, those relationship updates will appear here.',
      }
    case 'like':
      return {
        badge: 'Post engagement',
        title: 'No likes yet',
        body: 'Likes on your content will appear here as they happen.',
      }
    case 'comment':
      return {
        badge: 'Conversation',
        title: 'No comments yet',
        body: 'Comments on your posts will appear here as they arrive.',
      }
    default:
      return {
        badge: 'Activity',
        title: 'No activity yet',
        body: 'Follows, likes, and comments will appear here once your app starts receiving engagement.',
      }
  }
}

function formatGroupLabel(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const sameYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (sameDay) return 'Today'
  if (sameYesterday) return 'Yesterday'

  return date.toLocaleDateString()
}

function groupNotificationsByDate(notifications: NotificationItem[]) {
  const groups = new Map<string, NotificationItem[]>()

  for (const notification of notifications) {
    const key = formatGroupLabel(notification.created_at)
    const existing = groups.get(key) || []
    existing.push(notification)
    groups.set(key, existing)
  }

  return Array.from(groups.entries())
}

export function ActivityList({
  filter,
  notifications,
}: ActivityListProps) {
  const grouped = groupNotificationsByDate(notifications)
  const unreadCount = notifications.filter((item) => !item.read_at).length
  const engagementCount = notifications.filter(
    (item) => item.type === 'like' || item.type === 'comment'
  ).length
  const followCount = notifications.filter((item) => item.type === 'follow').length
  const emptyCopy = getEmptyCopy(filter)

  if (!notifications.length) {
    return (
      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(120,119,255,0.08),transparent_30%)]" />

        <div className="relative flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-800 bg-zinc-950/80 px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
            <Bell className="h-3.5 w-3.5" />
            {emptyCopy.badge}
          </div>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            {emptyCopy.title}
          </h2>

          <p className="mt-3 max-w-md text-sm leading-7 text-zinc-300">
            {emptyCopy.body}
          </p>

          <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-zinc-800 bg-black/70 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Unread
              </p>
              <p className="mt-2 text-lg font-semibold text-white">0</p>
            </div>

            <div className="rounded-[22px] border border-zinc-800 bg-black/70 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Engagement
              </p>
              <p className="mt-2 text-lg font-semibold text-white">0</p>
            </div>

            <div className="rounded-[22px] border border-zinc-800 bg-black/70 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Follows
              </p>
              <p className="mt-2 text-lg font-semibold text-white">0</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/feed"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
            >
              Back to feed
            </Link>

            <Link
              href="/explore"
              className="inline-flex items-center justify-center rounded-2xl border border-white/80 bg-white px-5 py-3 text-sm font-semibold !text-black transition hover:-translate-y-0.5 hover:opacity-90"
            >
              Explore creators
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(120,119,255,0.08),transparent_28%)]" />

      <div className="relative border-b border-zinc-800/80 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              <Sparkles className="h-3.5 w-3.5" />
              Stream
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Activity stream
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
              All notification events stay grouped and easier to scan, with clearer unread visibility and direct routes back into posts and creators.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              {notifications.length} items
            </span>

            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              {unreadCount} unread
            </span>
          </div>
        </div>
      </div>

      <div className="relative grid gap-3 border-b border-zinc-800/80 px-5 py-5 sm:grid-cols-3 sm:px-6">
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
          <div className="flex items-center gap-2 text-zinc-300">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Unread
            </p>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{unreadCount}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Items still waiting for review.
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
          <div className="flex items-center gap-2 text-zinc-300">
            <MessageCircle className="h-4 w-4" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Engagement
            </p>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{engagementCount}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Likes and comments in the current filtered stream.
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700 hover:bg-zinc-950">
          <div className="flex items-center gap-2 text-zinc-300">
            <UserPlus className="h-4 w-4" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Follows
            </p>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{followCount}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Creator relationship events in this view.
          </p>
        </div>
      </div>

      <div className="relative px-5 py-5 sm:px-6">
        <div className="space-y-8">
          {grouped.map(([label, items]) => (
            <section key={label}>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                  {label}
                </div>

                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <div className="space-y-3">
                {items.map((notification) => (
                  <ActivityItem key={notification.id} notification={notification} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}