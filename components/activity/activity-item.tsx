import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { SmartImage } from '@/components/ui/smart-image'
import { markNotificationReadAndRedirect } from '@/actions/notifications'
import { getMediaUrl } from '@/lib/media/get-media-url'

type NotificationItem = {
  id: string
  type: 'follow' | 'like' | 'comment' | 'profile_view'
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

type ActivityItemProps = {
  notification: NotificationItem
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)}d ago`

  return date.toLocaleDateString()
}

function getProfileHref(profileId: string | null | undefined) {
  const safeProfileId = String(profileId || '').trim()
  if (!safeProfileId) return '/profile'
  return `/profile/${safeProfileId}`
}

function getPostHref(postId: string | null | undefined) {
  const safePostId = String(postId || '').trim()
  if (!safePostId) return '/activity'
  return `/post/${safePostId}`
}

function getNotificationText(notification: NotificationItem) {
  const actorName =
    notification.actor?.username ||
    notification.actor?.display_name ||
    'Someone'

  switch (notification.type) {
    case 'follow':
      return {
        eyebrow: 'Follow event',
        primary: `${actorName} followed you`,
        secondary: '',
      }
    case 'like':
      return {
        eyebrow: 'Like event',
        primary: `${actorName} liked your post`,
        secondary: notification.post?.caption
          ? notification.post.caption
          : 'Your post received a new like.',
      }
    case 'comment':
      return {
        eyebrow: 'Comment event',
        primary: `${actorName} commented on your post`,
        secondary: notification.comment?.body
          ? notification.comment.body
          : 'Your post received a new comment.',
      }
    case 'profile_view':
      return {
        eyebrow: 'Profile visit',
        primary: `${actorName} viewed your profile`,
        secondary: '',
      }
    default:
      return {
        eyebrow: 'Activity',
        primary: `${actorName} interacted`,
        secondary: 'New engagement detected.',
      }
  }
}

export async function ActivityItem({ notification }: ActivityItemProps) {
  const actorAvatarUrl = await getMediaUrl(notification.actor?.avatar_url ?? null)
  const postPreviewUrl = await getMediaUrl(
    notification.post?.thumbnail_path ?? notification.post?.media_path ?? null
  )

  const actorProfileHref = getProfileHref(
    notification.actor?.id ?? notification.actor_profile_id
  )
  const postHref = getPostHref(notification.post?.id)
  const text = getNotificationText(notification)
  return <article className="flex min-w-0 items-start gap-3 py-4">
    <Link href={actorProfileHref} aria-label="View creator profile" className="shrink-0 rounded-full"><SmartImage src={actorAvatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" fallbackClassName="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-sm" fallbackText="?" /></Link>
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{text.primary}</p>{text.secondary ? <p className="mt-1 line-clamp-2 break-words text-sm text-zinc-300">{text.secondary}</p> : null}<p className="mt-1 text-xs text-zinc-400">{formatRelativeTime(notification.created_at)}{!notification.read_at ? <span className="ml-2 text-violet-300">Unread</span> : null}</p><div className="mt-2 flex flex-wrap gap-2"><form action={markNotificationReadAndRedirect}><input type="hidden" name="notification_id" value={notification.id} /><input type="hidden" name="target_href" value={notification.post?.id ? postHref : actorProfileHref} /><input type="hidden" name="return_to" value="/activity" /><button type="submit" className="rs-button">{notification.post?.id ? 'View post' : 'View profile'}</button></form>{notification.post?.id ? <Link href={actorProfileHref} className="rs-button">View profile</Link> : null}</div></div>
    {notification.post?.id ? <Link href={postHref} aria-label="View post" className="shrink-0 rounded-lg"><SmartImage src={postPreviewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" fallbackClassName="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-800 text-xs" fallbackText="Post" /></Link> : null}
  </article>
}
