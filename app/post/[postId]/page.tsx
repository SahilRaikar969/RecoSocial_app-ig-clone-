import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clapperboard, MessageCircle } from 'lucide-react'
import { deleteCommentByOwner } from '@/actions/comments'
import { deletePost } from '@/actions/posts'
import { FeedList } from '@/components/feed/feed-list'
import { CommentThreadPanel } from '@/components/feed/comment-thread-panel'
import { PostEngagementPanel } from '@/components/feed/post-engagement-panel'
import { PostMedia } from '@/components/feed/post-media'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { CopyPostLinkButton } from '@/components/post/copy-post-link-button'
import { PostViewerControls } from '@/components/post/post-viewer-controls'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getPostPageData } from '@/lib/db/queries/post'
import { getViewerPostModerationState } from '@/lib/db/queries/post-moderation'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { buildPostOpenHref } from '@/lib/routes/media-links'

type PostDetailPageProps = {
  params: Promise<{
    postId: string
  }>
  searchParams?: Promise<{
    updated?: string
    comment?: string
    comment_deleted?: string
    liked?: string
    saved?: string
    hidden?: string
    reported?: string
    deleted?: string
    error?: string
  }>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function getProfileHref(profileId: string | null | undefined, viewerProfileId: string) {
  const safeProfileId = String(profileId || '').trim()
  if (!safeProfileId) return '/profile'
  if (safeProfileId === viewerProfileId) return '/profile'
  return `/profile/${safeProfileId}`
}

function DeletePostButton() {
  return (
    <button
      type="submit"
      className="rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-200 transition hover:border-red-700 hover:bg-red-950/60"
    >
      Delete post
    </button>
  )
}

function DeleteCommentButton() {
  return (
    <button
      type="submit"
      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
    >
      Delete
    </button>
  )
}

export default async function PostDetailPage({
  params,
  searchParams,
}: PostDetailPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const postId = String(resolvedParams?.postId || '').trim()
  const { profileId } = await getDevSession()

  const post = await getPostPageData(profileId, postId)

  if (!post) {
    notFound()
  }

  const returnTo = `/post/${post.id}`

  const mediaUrl = await getMediaUrl(post.media_path)
  const thumbnailUrl = await getMediaUrl(post.thumbnail_path ?? null)
  const authorAvatarUrl = await getMediaUrl(post.author?.avatar_url ?? null)

  const categories = Array.isArray(post.post_categories)
    ? post.post_categories.flatMap((item: any) =>
        !item?.categories
          ? []
          : Array.isArray(item.categories)
            ? item.categories
            : [item.categories]
      )
    : []

  const relatedPosts = Array.isArray(post.related_posts) ? post.related_posts : []

  const isPostOwner = post.author_id === profileId
  const authorProfileHref = getProfileHref(post.author?.id ?? post.author_id, profileId)

  const moderationState = !isPostOwner
    ? await getViewerPostModerationState(profileId, post.id)
    : { hiddenByViewer: false, reportedByViewer: false }

  const feedback =
    resolvedSearchParams?.updated === '1'
      ? 'Post updated successfully.'
      : resolvedSearchParams?.comment === 'added'
        ? 'Comment posted.'
        : resolvedSearchParams?.comment_deleted === '1'
          ? 'Comment deleted.'
          : resolvedSearchParams?.liked === 'added'
            ? 'Post liked.'
            : resolvedSearchParams?.liked === 'removed'
              ? 'Like removed.'
              : resolvedSearchParams?.saved === 'added'
                ? 'Post saved.'
                : resolvedSearchParams?.saved === 'removed'
                  ? 'Post removed from saved.'
                  : resolvedSearchParams?.hidden === '1'
                    ? 'Post hidden from your feed and explore.'
                    : resolvedSearchParams?.reported === '1'
                      ? 'Post reported.'
                      : resolvedSearchParams?.deleted === '1'
                        ? 'Post deleted.'
                        : ''

  const error = resolvedSearchParams?.error || ''

  const errorMessage =
    error === 'not_post_owner'
      ? 'You can only manage your own post.'
      : error === 'post_not_found'
        ? 'Post not found.'
        : error === 'missing_post_delete_ids'
          ? 'Missing delete ids.'
          : error === 'missing_post_update_ids'
            ? 'Missing update ids.'
            : error === 'missing_comment_delete_ids'
              ? 'Missing comment delete ids.'
              : error === 'missing_hide_ids'
                ? 'Missing hide ids.'
                : error === 'missing_report_ids'
                  ? 'Missing report ids.'
                  : error === 'comment_not_found'
                    ? 'Comment not found.'
                    : error === 'cannot_hide_own_post'
                      ? 'You cannot hide your own post.'
                      : error === 'cannot_report_own_post'
                        ? 'You cannot report your own post.'
                        : error
                          ? `Action failed: ${decodeURIComponent(error)}`
                          : ''

  const initialComments = Array.isArray(post.comments) ? post.comments : []

  const openMediaHref = buildPostOpenHref({
    postId: post.id,
    mediaType: post.media_type,
    source: 'post',
  })

  const relatedTitle =
    post.media_type === 'video' ? 'More reels to watch' : 'Keep exploring'
  const relatedSubtitle =
    post.media_type === 'video'
      ? 'More video posts from this creator and nearby topic signals.'
      : 'More posts from this creator and nearby category signals, ranked from the current post context.'

  return (
    <main className="mx-auto w-full max-w-[1180px] px-0">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <section className="mb-4 rounded-[28px] border border-zinc-800/90 bg-black px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={authorProfileHref}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Creator
              </Link>

              <Link
                href="#comments"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Comments
              </Link>

              {post.media_type === 'video' ? (
                <Link
                  href={openMediaHref}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:border-zinc-500"
                >
                  <Clapperboard className="h-3.5 w-3.5" />
                  Open in reels
                </Link>
              ) : null}
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Post detail
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400">
              Media, creator context, engagement, moderation, and conversation stay on one focused surface.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[320px]">
            <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Likes</p>
              <p className="mt-2 text-lg font-semibold text-white">{post.like_count}</p>
            </div>
            <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Comments</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {initialComments.length || post.comment_count}
              </p>
            </div>
            <div className="rounded-[22px] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Saves</p>
              <p className="mt-2 text-lg font-semibold text-white">{post.save_count ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-zinc-800 xl:border-b-0 xl:border-r xl:border-zinc-800">
            <div className="border-b border-zinc-800/80 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href={authorProfileHref}
                  className="flex min-w-0 items-center gap-3 rounded-2xl transition hover:opacity-90"
                >
                  {authorAvatarUrl ? (
                    <img
                      src={authorAvatarUrl}
                      alt={post.author?.display_name || 'Creator'}
                      className="h-12 w-12 rounded-full border border-zinc-800 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      User
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {post.author?.username || 'creator'}
                      </p>

                      {isPostOwner ? (
                        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                          Your post
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {post.author?.display_name || 'Creator'} · {formatDate(post.created_at)}
                    </p>
                  </div>
                </Link>

                <div className="flex flex-wrap gap-2">
                  <CopyPostLinkButton postId={post.id} />

                  <Link
                    href={authorProfileHref}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    View creator
                  </Link>

                  {post.media_type === 'video' ? (
                    <Link
                      href={openMediaHref}
                      className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      Watch in reels
                    </Link>
                  ) : null}

                  {isPostOwner ? (
                    <Link
                      href={`/post/${post.id}/edit`}
                      className="rounded-2xl border border-white bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                    >
                      Edit post
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bg-zinc-950">
              <PostMedia
                mediaType={post.media_type}
                mediaUrl={mediaUrl}
                thumbnailUrl={thumbnailUrl}
                alt={post.caption ?? 'Post media'}
                priorityLabel={null}
              />
            </div>

            <div className="px-4 pb-5 pt-4 sm:px-5 sm:pt-5">
              <PostEngagementPanel
                postId={post.id}
                devProfileId={profileId}
                returnTo={returnTo}
                initialLikedByMe={post.liked_by_me}
                initialSavedByMe={post.saved_by_me}
                initialLikeCount={post.like_count}
                initialSaveCount={post.save_count ?? 0}
                commentCount={initialComments.length || post.comment_count}
                commentsHref="#comments"
                commentsLabel={
                  (initialComments.length || post.comment_count) > 0
                    ? `View all ${initialComments.length || post.comment_count} comments`
                    : 'Start the conversation'
                }
                secondaryHref={openMediaHref}
                secondaryAriaLabel={post.media_type === 'video' ? 'Watch reel' : 'Open post'}
              />

              {post.reason_labels && post.reason_labels.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.reason_labels.slice(0, 3).map((label: string) => (
                    <span
                      key={label}
                      className="rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1 text-[11px] font-medium text-emerald-200"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}

              {categories.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category: any) => (
                    <Link
                      key={category.id}
                      href={`/explore?category=${encodeURIComponent(category.slug)}`}
                      className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Creator followers
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {post.author_summary?.follower_count ?? 0}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Audience size on this creator surface.
                  </p>
                </div>

                <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Creator posts
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {post.author_summary?.post_count ?? 0}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Total published posts from this creator.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Caption
                </p>

                {post.caption ? (
                  <p className="mt-3 text-[15px] leading-8 text-zinc-200">
                    <Link
                      href={authorProfileHref}
                      className="mr-2 font-semibold text-white transition hover:text-zinc-300"
                    >
                      {post.author?.username || 'creator'}
                    </Link>
                    {post.caption}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No caption</p>
                )}
              </div>

              {!isPostOwner ? (
                <div className="mt-5">
                  <PostViewerControls
                    postId={post.id}
                    devProfileId={profileId}
                    returnTo={returnTo}
                    hiddenByViewer={moderationState.hiddenByViewer}
                    reportedByViewer={moderationState.reportedByViewer}
                    authorProfileHref={authorProfileHref}
                    authorUsername={post.author?.username || 'creator'}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <aside id="comments" className="scroll-mt-24 flex min-h-full flex-col">
            <div className="border-b border-zinc-800 px-4 py-4 sm:px-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Comments
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">Thread</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Post discussion, creator context, and quick response flow in one cleaner rail.
              </p>
            </div>

            <div className="flex-1 px-4 py-4 sm:px-5 sm:py-5">
              {initialComments.length > 0 && isPostOwner ? (
                <div className="mb-4 space-y-3">
                  {initialComments.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Link
                          href={getProfileHref(comment.author?.id ?? comment.author_id, profileId)}
                          className="shrink-0 rounded-full transition hover:opacity-90"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                            User
                          </div>
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={getProfileHref(comment.author?.id ?? comment.author_id, profileId)}
                              className="text-sm font-semibold text-white transition hover:text-zinc-300"
                            >
                              {comment.author?.username || 'user'}
                            </Link>

                            <span className="text-xs text-zinc-500">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm leading-7 text-zinc-300">
                            {comment.body}
                          </p>
                        </div>

                        <form action={deleteCommentByOwner}>
                          <input type="hidden" name="comment_id" value={comment.id} />
                          <input type="hidden" name="post_id" value={post.id} />
                          <input type="hidden" name="dev_profile_id" value={profileId} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <DeleteCommentButton />
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!isPostOwner ? (
                <CommentThreadPanel
                  postId={post.id}
                  profileId={profileId}
                  returnTo={returnTo}
                  initialComments={initialComments}
                  showAllComments
                  postOwnerId={post.author_id}
                />
              ) : initialComments.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-zinc-800 bg-zinc-950/80 px-4 py-6 text-sm text-zinc-500">
                  No comments yet.
                </div>
              ) : null}
            </div>

            {isPostOwner ? (
              <div className="border-t border-zinc-800 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/post/${post.id}/edit`}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                  >
                    Edit post
                  </Link>

                  <form action={deletePost}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <input type="hidden" name="dev_profile_id" value={profileId} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <DeletePostButton />
                  </form>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {relatedPosts.length > 0 ? (
        <div className="mt-8">
          <FeedList
            posts={relatedPosts}
            devProfileId={profileId}
            emptyMode="explore"
            title={relatedTitle}
            subtitle={relatedSubtitle}
            returnToBase={returnTo}
          />
        </div>
      ) : null}
    </main>
  )
}