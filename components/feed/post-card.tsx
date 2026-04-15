import Link from 'next/link'
import { PostEngagementPanel } from '@/components/feed/post-engagement-panel'
import { CommentThreadPanel } from '@/components/feed/comment-thread-panel'
import { PostDetailDisclosure } from '@/components/feed/post-detail-disclosure'
import { PostMedia } from '@/components/feed/post-media'
import { PostViewerControls } from '@/components/post/post-viewer-controls'
import { AnimatedShellCard } from '@/components/ui/animated-shell-card'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { getViewerPostModerationState } from '@/lib/db/queries/post-moderation'
import { buildPostOpenHref } from '@/lib/routes/media-links'

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
  devProfileId: string
  returnTo?: string
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

function getProfileHref(profileId: string | null | undefined, viewerProfileId?: string) {
  const safeProfileId = String(profileId || '').trim()
  if (!safeProfileId) return '/profile'
  if (viewerProfileId && safeProfileId === viewerProfileId) return '/profile'
  return `/profile/${safeProfileId}`
}

export async function PostCard({
  post,
  devProfileId,
  returnTo = '/feed',
  showAllComments = false,
  showOpenPostLink = true,
}: PostCardProps) {
  const categories = normalizeCategories(post.post_categories)

  const isRecommended =
    typeof post.explore_score === 'number' && post.explore_score > 0

  const isPersonalized =
    typeof post.feed_score === 'number' && post.feed_score > 0

  const mediaUrl = await getMediaUrl(post.media_path)
  const thumbnailUrl = await getMediaUrl(post.thumbnail_path ?? null)
  const authorAvatarUrl = await getMediaUrl(post.author?.avatar_url ?? null)

  const priorityLabel = isRecommended
    ? 'Recommended'
    : isPersonalized
      ? 'For you'
      : null

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
    source: 'feed',
  })

  const openLabel = post.media_type === 'video' ? 'Watch reel' : 'Open post'

  const moderationState = !isPostOwner
    ? await getViewerPostModerationState(devProfileId, post.id)
    : { hiddenByViewer: false, reportedByViewer: false }

  const resolvedCommentCount = Array.isArray(post.comments)
    ? post.comments.length
    : post.comment_count

  return (
    <AnimatedShellCard>
      <article className="group relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(14,14,18,0.96),rgba(5,5,7,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.34)] transition duration-300 hover:-translate-y-0.5 hover:border-zinc-700/90 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_90px_rgba(0,0,0,0.42)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.07),transparent_24%)] opacity-80" />

        <div className="relative flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-4 sm:px-5">
          <Link
            href={authorProfileHref}
            className="flex min-w-0 items-center gap-3 rounded-2xl transition hover:opacity-90"
          >
            {authorAvatarUrl ? (
              <img
                src={authorAvatarUrl}
                alt={authorDisplayName}
                className="h-11 w-11 rounded-full border border-zinc-700 object-cover ring-2 ring-white/5"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                User
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">
                  {authorUsername}
                </p>

                {priorityLabel ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      isRecommended
                        ? 'border-violet-400/20 bg-violet-500/10 text-violet-100'
                        : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                    }`}
                  >
                    {priorityLabel}
                  </span>
                ) : null}

                {isPostOwner ? (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    Your post
                  </span>
                ) : null}
              </div>

              <p className="mt-1 truncate text-xs text-zinc-400">
                {authorDisplayName} · {formatDate(post.created_at)}
              </p>
            </div>
          </Link>

          {showOpenPostLink ? (
            <Link
              href={openHref}
              className="rounded-full border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-100 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
            >
              {openLabel}
            </Link>
          ) : null}
        </div>

        <div className="relative">
          <PostMedia
            mediaType={post.media_type}
            mediaUrl={mediaUrl}
            thumbnailUrl={thumbnailUrl}
            alt={post.caption ?? 'Post media'}
            priorityLabel={priorityLabel}
          />
        </div>

        <div className="relative px-4 pb-5 pt-4 sm:px-5">
          <PostEngagementPanel
            postId={post.id}
            devProfileId={devProfileId}
            returnTo={returnTo}
            initialLikedByMe={post.liked_by_me}
            initialSavedByMe={post.saved_by_me}
            initialLikeCount={post.like_count}
            initialSaveCount={post.save_count ?? 0}
            commentCount={resolvedCommentCount}
            commentsHref={`/post/${post.id}`}
            commentsLabel={
              resolvedCommentCount > 0
                ? `View ${resolvedCommentCount} comment${resolvedCommentCount === 1 ? '' : 's'}`
                : 'Start the conversation'
            }
            secondaryHref={openHref}
            secondaryAriaLabel={post.media_type === 'video' ? 'Watch reel' : 'Open post'}
          />

          <PostDetailDisclosure defaultOpen={showAllComments}>
            <div className="space-y-4">
              {post.caption ? (
                <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 px-4 py-4">
                  <p className="text-[15px] leading-7 text-zinc-200">
                    <Link
                      href={authorProfileHref}
                      className="mr-2 font-semibold text-white transition hover:text-zinc-300"
                    >
                      {authorUsername}
                    </Link>
                    {post.caption}
                  </p>
                </div>
              ) : null}

              {categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/explore?category=${encodeURIComponent(category.slug)}`}
                      className="rounded-full border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-white"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              {post.reason_labels && post.reason_labels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {post.reason_labels.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1.5 text-[11px] font-medium text-emerald-200 shadow-[0_10px_25px_rgba(16,185,129,0.06)]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {(showAllComments || (post.comments && post.comments.length > 0)) ? (
              <div className="rounded-[26px] border border-zinc-800 bg-black/35 p-4">
                <CommentThreadPanel
                  postId={post.id}
                  profileId={devProfileId}
                  returnTo={returnTo}
                  initialComments={post.comments ?? []}
                  showAllComments={showAllComments}
                  postOwnerId={post.author_id}
                />
              </div>
            ) : null}

            {!isPostOwner ? (
              <PostViewerControls
                postId={post.id}
                devProfileId={devProfileId}
                returnTo={returnTo}
                hiddenByViewer={moderationState.hiddenByViewer}
                reportedByViewer={moderationState.reportedByViewer}
                authorProfileHref={authorProfileHref}
                authorUsername={authorUsername}
              />
            ) : null}
          </PostDetailDisclosure>
        </div>
      </article>
    </AnimatedShellCard>
  )
}