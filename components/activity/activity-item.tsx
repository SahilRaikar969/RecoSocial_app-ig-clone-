import Link from 'next/link'
import { Eye, Heart, MessageCircle, Sparkles, UserPlus } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'
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
        secondary: 'Relationship update added to your creator graph.',
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
        secondary: 'A creator opened your profile for the first time.',
      }
    default:
      return {
        eyebrow: 'Activity',
        primary: `${actorName} interacted`,
        secondary: 'New engagement detected.',
      }
  }
}

function NotificationTypeIcon({ type }: { type: NotificationItem['type'] }) {
  if (type === 'follow') return <UserPlus className="h-3.5 w-3.5" />
  if (type === 'comment') return <MessageCircle className="h-3.5 w-3.5" />
  if (type === 'profile_view') return <Eye className="h-3.5 w-3.5" />
  return <Heart className="h-3.5 w-3.5" />
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
  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] transition duration-300 hover:bg-white/[0.06]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_24%)] opacity-80" />

      <div className="relative flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Link
            href={actorProfileHref}
            className="shrink-0 rounded-full transition hover:opacity-90"
          >
            <SmartImage
              src={actorAvatarUrl}
              alt={notification.actor?.display_name || notification.actor?.username || 'User'}
              className="h-12 w-12 rounded-full border border-zinc-700 object-cover ring-2 ring-white/5"
              fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
              fallbackText="User"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                <NotificationTypeIcon type={notification.type} />
                {text.eyebrow}
              </div>

              <span className="text-xs text-zinc-500">
                {formatRelativeTime(notification.created_at)}
              </span>

              {!notification.read_at ? (
                <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-pink-100">
                  New
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-sm font-semibold text-white">
              {text.primary}
            </p>

            <div className="mt-2 rounded-[20px] border border-white/10 bg-black/40 px-4 py-3">
              <p className="text-sm leading-6 text-zinc-300">{text.secondary}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={actorProfileHref}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-white/25 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                View creator
              </Link>

              {notification.post?.id ? (
                <Link
                  href={postHref}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-white/25 hover:text-white"
                >
                  Open post
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {notification.post?.id ? (
          <Link
            href={postHref}
            className="shrink-0 self-start rounded-[22px] border border-white/10 bg-black/60 p-1 transition hover:-translate-y-0.5 hover:border-white/25"
          >
            <SmartImage
              src={postPreviewUrl}
              alt={notification.post.caption || 'Post preview'}
              className="h-20 w-20 rounded-[18px] object-cover"
              fallbackClassName="flex h-20 w-20 items-center justify-center rounded-[18px] bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
              fallbackText="Post"
            />
          </Link>
        ) : null}
      </div>
    </article>
  )
}