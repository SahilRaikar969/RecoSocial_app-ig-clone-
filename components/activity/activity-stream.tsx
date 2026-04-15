import Link from 'next/link'
import { getMediaUrl } from '@/lib/media/get-media-url'

type ActivityItem = {
  id: string
  type: string
  created_at: string
  read_at?: string | null
  actor?: {
    id: string
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
  post?: {
    id: string
    media_type?: string | null
    media_path?: string | null
    thumbnail_path?: string | null
    caption?: string | null
  } | null
}

type ActivityStreamProps = {
  items: ActivityItem[]
  emptyTitle?: string
  emptyBody?: string
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))

  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}w`

  return new Date(value).toLocaleDateString()
}

function getActivityMessage(type: string) {
  switch (type) {
    case 'like':
      return 'liked your post'
    case 'comment':
      return 'commented on your post'
    case 'follow':
      return 'started following you'
    case 'save':
      return 'saved your post'
    case 'report':
      return 'reported a post'
    default:
      return 'interacted with your content'
  }
}

function getActorHref(actorId: string | undefined | null) {
  const safeActorId = String(actorId || '').trim()
  return safeActorId ? `/profile/${safeActorId}` : '/profile'
}

function getPostHref(postId: string | undefined | null) {
  const safePostId = String(postId || '').trim()
  return safePostId ? `/post/${safePostId}` : '/activity'
}

export async function ActivityStream({
  items,
  emptyTitle = 'No activity yet',
  emptyBody = 'When people like, comment, follow, or save, those updates will appear here.',
}: ActivityStreamProps) {
  if (!items.length) {
    return (
      <section className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            Activity
          </div>
        </div>

        <div className="px-5 py-10 sm:px-6">
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-800 bg-zinc-950/80 px-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {emptyTitle}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
              {emptyBody}
            </p>
          </div>
        </div>
      </section>
    )
  }

  const resolvedItems = await Promise.all(
    items.map(async (item) => {
      const actorAvatarUrl = await getMediaUrl(item.actor?.avatar_url ?? null)

      const previewUrl =
        item.post?.media_type === 'video'
          ? await getMediaUrl(item.post?.thumbnail_path ?? null)
          : null

      const postPreviewUrl =
        previewUrl || (await getMediaUrl(item.post?.media_path ?? null))

      return {
        ...item,
        actorAvatarUrl,
        postPreviewUrl,
      }
    })
  )

  return (
    <section className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
      <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
        <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          Activity
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Notifications
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Follows, likes, comments, saves, and other creator-facing signals in one compact stream.
        </p>
      </div>

      <div className="divide-y divide-zinc-800">
        {resolvedItems.map((item) => {
          const actorUsername =
            String(item.actor?.username || '').trim() || 'creator'
          const actorDisplayName =
            String(item.actor?.display_name || '').trim() || 'Creator'
          const unread = !item.read_at

          return (
            <div
              key={item.id}
              className={`px-4 py-4 sm:px-6 ${
                unread ? 'bg-zinc-950/90' : 'bg-black'
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <Link
                  href={getActorHref(item.actor?.id)}
                  className="shrink-0 rounded-full transition hover:opacity-90"
                >
                  {item.actorAvatarUrl ? (
                    <img
                      src={item.actorAvatarUrl}
                      alt={actorDisplayName}
                      className="h-12 w-12 rounded-full border border-zinc-800 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      User
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={getActorHref(item.actor?.id)}
                      className="truncate text-sm font-semibold text-white transition hover:text-zinc-300"
                    >
                      {actorUsername}
                    </Link>

                    <span className="text-sm text-zinc-300">
                      {getActivityMessage(item.type)}
                    </span>

                    <span className="text-xs text-zinc-500">
                      {formatRelativeTime(item.created_at)}
                    </span>

                    {unread ? (
                      <span className="rounded-full border border-white/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-black">
                        New
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm text-zinc-500">
                    {actorDisplayName}
                  </p>

                  {item.post?.caption ? (
                    <Link
                      href={getPostHref(item.post?.id)}
                      className="mt-3 line-clamp-2 block text-sm leading-6 text-zinc-400 transition hover:text-zinc-200"
                    >
                      {item.post.caption}
                    </Link>
                  ) : null}
                </div>

                {item.post ? (
                  <Link
                    href={getPostHref(item.post.id)}
                    className="shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-700"
                  >
                    {item.postPreviewUrl ? (
                      <img
                        src={item.postPreviewUrl}
                        alt="Post preview"
                        className="h-14 w-14 object-cover sm:h-16 sm:w-16"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:h-16 sm:w-16">
                        Post
                      </div>
                    )}
                  </Link>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}