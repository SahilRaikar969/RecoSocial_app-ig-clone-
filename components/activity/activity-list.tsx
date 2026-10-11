import { NavigationLink as Link } from '@/components/ui/navigation-link'
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
        badge: 'Follows',
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
        body: 'Follows, likes and comments will appear here.',
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

export function ActivityList({ filter, notifications }: ActivityListProps) {
  const grouped = groupNotificationsByDate(notifications)
  const empty = getEmptyCopy(filter)
  if (!notifications.length) return <section className="rounded-xl border border-zinc-800 px-5 py-10 text-center"><h2 className="text-lg font-semibold">{empty.title}</h2><p className="mt-2 text-sm text-zinc-400">{empty.body}</p><Link href="/explore" className="rs-button mt-5">Explore</Link></section>
  return <div className="space-y-6">{grouped.map(([label, items]) => <section key={label}><h2 className="mb-3 text-sm font-semibold text-zinc-300">{label}</h2><div className="divide-y divide-zinc-800">{items.map(notification => <ActivityItem key={notification.id} notification={notification} />)}</div></section>)}</div>
}
