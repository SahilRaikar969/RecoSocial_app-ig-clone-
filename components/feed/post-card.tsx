import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { PostEngagementPanel } from '@/components/feed/post-engagement-panel'
import { CommentThreadPanel } from '@/components/feed/comment-thread-panel'
import { PostDetailDisclosure } from '@/components/feed/post-detail-disclosure'
import { PostMedia } from '@/components/feed/post-media'
import { PostViewerControls } from '@/components/post/post-viewer-controls'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { getViewerPostModerationState, type ViewerPostModerationState } from '@/lib/db/queries/post-moderation'
import { buildPostOpenHref, mediaContextFromReturnTo } from '@/lib/routes/media-links'

type Category = {
  category_id: string
  categories?:
    | {
        id: string
        name: string
        slug: string
      }
    | Array<{
        id: string
        name: string
        slug: string
      }>
    | null
}

type Comment = {
  id: string
  author_id: string
  author?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
  } | null
  body: string
  created_at: string
}

export type PostCardPost = PostCardProps['post']

type PostCardProps = {
  post: {
    id: string
    author_id: string
    author?: {
      id: string
      username: string
      display_name: string
      avatar_url?: string | null
    } | null
    caption: string | null
    media_type: string
    media_path: string
    thumbnail_path?: string | null
    created_at: string
    like_count: number
    liked_by_me: boolean
    save_count: number
    saved_by_me: boolean
    comment_count: number
    comments?: Comment[]
    post_categories?: Category[]
    explore_score?: number
    feed_score?: number
    reason_labels?: string[]
  }
  devProfileId: string | null
  returnTo?: string
  moderationState?: ViewerPostModerationState
  showAllComments?: boolean
  showOpenPostLink?: boolean
}

function normalizeCategories(items: Category[] | undefined) {
  return (items ?? [])
    .flatMap((item) => {
      if (!item?.categories) return []
      return Array.isArray(item.categories) ? item.categories : [item.categories]
    })
    .filter(Boolean)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function getProfileHref(profileId: string | null | undefined, viewerProfileId?: string | null) {
  const safeProfileId = String(profileId || '').trim()
  if (!safeProfileId) return '/profile'
  if (viewerProfileId && safeProfileId === viewerProfileId) return '/profile'
  return `/profile/${safeProfileId}`
}

export async function PostCard({
  post,
  devProfileId,
  returnTo = '/feed',
  moderationState: suppliedModerationState,
  showAllComments = false,
  showOpenPostLink = true,
}: PostCardProps) {
  const categories = normalizeCategories(post.post_categories)

  const mediaUrl = await getMediaUrl(post.media_path)
  const thumbnailUrl = await getMediaUrl(post.thumbnail_path ?? null)
  const authorAvatarUrl = await getMediaUrl(post.author?.avatar_url ?? null)

  const authorDisplayName = post.author?.display_name || 'Creator'
  const authorUsername = post.author?.username || 'creator'
  const isPostOwner = post.author_id === devProfileId
  const authorProfileHref = getProfileHref(
    post.author?.id ?? post.author_id,
    devProfileId
  )

  const openHref = buildPostOpenHref({
    postId: post.id,
    mediaType: post.media_type,
    ...mediaContextFromReturnTo(returnTo),
  })

  const openLabel = post.media_type === 'video' ? 'Watch reel' : 'Open post'

  const moderationState = devProfileId && !isPostOwner
    ? suppliedModerationState ?? await getViewerPostModerationState(devProfileId, post.id)
    : { hiddenByViewer: false, reportedByViewer: false }

  const resolvedCommentCount = post.comment_count

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <header className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <Link href={authorProfileHref} className="flex min-w-0 items-center gap-3 rounded-lg">
          {authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- User avatar URLs may be signed or external; retain direct delivery without proxying or rewriting them.
            <img src={authorAvatarUrl} alt="" loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-full border border-zinc-700 object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">{authorDisplayName.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{authorUsername}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-400"><time dateTime={post.created_at}>{formatDate(post.created_at)}</time>{isPostOwner ? ' · Your post' : ''}</p>
          </div>
        </Link>
        {showOpenPostLink ? <Link href={openHref} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white">{openLabel}</Link> : null}
      </header>
      <PostMedia mediaType={post.media_type} mediaUrl={mediaUrl} thumbnailUrl={thumbnailUrl} alt={post.caption || 'Post by ' + authorUsername} />
      <div className="p-3 sm:p-4">
        <PostEngagementPanel postId={post.id} devProfileId={devProfileId} returnTo={returnTo} initialLikedByMe={post.liked_by_me} initialSavedByMe={post.saved_by_me} initialLikeCount={post.like_count} initialSaveCount={post.save_count ?? 0} commentCount={resolvedCommentCount} commentsHref={'/post/' + post.id} commentsLabel={resolvedCommentCount ? 'View comments' : 'Add a comment'} secondaryHref={openHref} secondaryAriaLabel={post.media_type === 'video' ? 'Watch reel' : 'Open post'} />
        {post.caption ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
            <Link href={authorProfileHref} className="mr-2 font-semibold text-white hover:underline">{authorUsername}</Link>
            {post.caption}
          </p>
        ) : null}
        <PostDetailDisclosure defaultOpen={showAllComments}>
          {categories.length > 0 ? (
            <nav aria-label="Post topics" className="flex flex-wrap gap-2">
              {categories.map(category => <Link key={category.id} href={'/explore?category=' + encodeURIComponent(category.slug)} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:bg-zinc-800">{category.name}</Link>)}
            </nav>
          ) : null}
          {post.comments === undefined ? <Link href={'/post/'+post.id} className="rs-button">View comments</Link> : <CommentThreadPanel postId={post.id} profileId={devProfileId} returnTo={returnTo} initialComments={post.comments ?? []} showAllComments={showAllComments} postOwnerId={post.author_id} />}
          {devProfileId && !isPostOwner ? <PostViewerControls postId={post.id} devProfileId={devProfileId} returnTo={returnTo} hiddenByViewer={moderationState.hiddenByViewer} reportedByViewer={moderationState.reportedByViewer} authorProfileHref={authorProfileHref} authorUsername={authorUsername} /> : null}
        </PostDetailDisclosure>
      </div>
    </article>
  )
}
