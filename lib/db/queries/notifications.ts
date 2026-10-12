import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'

type NotificationType = 'follow' | 'like' | 'comment' | 'profile_view'
type NotificationsFilter = 'all' | 'unread' | 'follow' | 'like' | 'comment'

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function getTargetHref(notification: {
  type?: string | null
  actor?: { id?: string | null } | null
  post?: { id?: string | null } | null
}) {
  const postId = String(notification.post?.id || '').trim()
  const actorId = String(notification.actor?.id || '').trim()

  if (postId) return `/post/${postId}`
  if (actorId) return `/profile/${actorId}`
  return '/activity'
}

function getNotificationMessage(notification: {
  type?: string | null
  actor?: {
    username?: string | null
    display_name?: string | null
  } | null
  comment?: {
    body?: string | null
  } | null
}) {
  const actorName =
    String(notification.actor?.username || '').trim() ||
    String(notification.actor?.display_name || '').trim() ||
    'Someone'

  const commentBody = String(notification.comment?.body || '').trim()

  switch (String(notification.type || '').toLowerCase()) {
    case 'follow':
      return `${actorName} started following you`
    case 'like':
      return `${actorName} liked your post`
    case 'comment':
      return commentBody
        ? `${actorName}: ${commentBody}`
        : `${actorName} commented on your post`
    case 'profile_view':
      return `${actorName} visited your profile`
    default:
      return `${actorName} interacted with your content`
  }
}

export async function getNotificationsPageData(
  profileId: string,
  filter: NotificationsFilter = 'all'
) {
  const supabase = await createClient()

  let query = supabase
    .from('notifications')
    .select(
      `
      id,
      recipient_id,
      actor_id,
      post_id,
      type,
      comment_id,
      created_at,
      read_at,
      actor:profiles!notifications_actor_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      ),
      post:posts (
        id,
        media_type,
        media_path,
        thumbnail_path,
        caption
      ),
      comment:comments (
        id,
        body
      )
    `
    )
    .eq('recipient_id', profileId)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(80)

  if (filter === 'unread') {
    query = query.is('read_at', null)
  }

  if (filter === 'follow' || filter === 'like' || filter === 'comment') {
    query = query.eq('type', filter)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const normalizedRows = (data ?? []).map((row) => {
    const actor = normalizeRelation(row.actor)
    const post = normalizeRelation(row.post)
    const comment = normalizeRelation(row.comment)

    return {
      id: row.id,
      recipient_id: row.recipient_id,
      actor_id: row.actor_id,
      post_id: row.post_id,
      type: row.type as NotificationType,
      comment_id: row.comment_id,
      created_at: row.created_at,
      read_at: row.read_at,
      actor,
      post,
      comment,
    }
  })

  const notifications = await Promise.all(
    normalizedRows.map(async (row) => {
      const postPreviewPath =
        row.post?.media_type === 'video'
          ? row.post?.thumbnail_path || row.post?.media_path || null
          : row.post?.media_path || row.post?.thumbnail_path || null

      return {
        id: row.id,
        type: row.type,
        created_at: row.created_at,
        read_at: row.read_at,
        actor_id: row.actor_id,
        post_id: row.post_id,
        actor: row.actor
          ? {
              ...row.actor,
              avatar_url: row.actor.avatar_url || null,
              avatar_resolved_url: await getMediaUrl(row.actor.avatar_url ?? null),
            }
          : null,
        post: row.post
          ? {
              ...row.post,
              preview_resolved_url: await getMediaUrl(postPreviewPath),
            }
          : null,
        comment: row.comment
          ? {
              id: row.comment.id,
              body: row.comment.body || null,
            }
          : null,
        target_href: getTargetHref({
          type: row.type,
          actor: row.actor,
          post: row.post,
        }),
        message: getNotificationMessage({
          type: row.type,
          actor: row.actor,
          comment: row.comment,
        }),
      }
    })
  )

  const summary = notifications.reduce(
    (acc, notification) => {
      acc.total += 1

      if (!notification.read_at) {
        acc.unread += 1
      }

      if (notification.type === 'follow') acc.follow += 1
      if (notification.type === 'like') acc.like += 1
      if (notification.type === 'comment') acc.comment += 1

      return acc
    },
    {
      total: 0,
      unread: 0,
      follow: 0,
      like: 0,
      comment: 0,
    }
  )

  return {
    notifications,
    summary,
    filter,
  }
}