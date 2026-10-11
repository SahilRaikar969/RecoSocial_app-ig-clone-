import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clapperboard } from 'lucide-react'
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
      className="min-h-11 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-200 transition hover:border-red-700 hover:bg-red-950/60"
    >
      Delete post
    </button>
  )
}

function DeleteCommentButton() {
  return (
    <button
      type="submit"
      className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
    >
      Delete
    </button>
  )
}

export const metadata = { title: "Post" }

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
                          ? 'Something went wrong. Please try again.'
                          : ''

  const initialComments = Array.isArray(post.comments) ? post.comments : []

  const openMediaHref = buildPostOpenHref({
    postId: post.id,
    mediaType: post.media_type,
    source: 'post',
  })

  const relatedTitle =
    post.media_type === 'video' ? 'More reels to watch' : 'Keep exploring'
  return (
    <div className="mx-auto w-full max-w-5xl">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-white">Post</h1>
        <Link href={authorProfileHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-zinc-300 hover:bg-zinc-800"><ArrowLeft className="h-4 w-4" />View profile</Link>
      </header>
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 border-b border-zinc-800 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href={authorProfileHref} className="flex min-w-0 items-center gap-3 rounded-lg">
                {authorAvatarUrl ? <img src={authorAvatarUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-300">{(post.author?.username || 'U').slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{post.author?.username || 'Creator'}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{formatDate(post.created_at)}{isPostOwner ? ' · Your post' : ''}</p>
                </div>
              </Link>
              {post.media_type === 'video' ? <Link href={openMediaHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-violet-300 hover:bg-violet-500/10"><Clapperboard className="h-4 w-4" />Watch reel</Link> : null}
            </div>
            <PostMedia mediaType={post.media_type} mediaUrl={mediaUrl} thumbnailUrl={thumbnailUrl} alt={post.caption ?? 'Post media'} priorityLabel={null} />
            <div className="px-4 py-4">
              <PostEngagementPanel postId={post.id} devProfileId={profileId} returnTo={returnTo}
                initialLikedByMe={post.liked_by_me} initialSavedByMe={post.saved_by_me}
                initialLikeCount={post.like_count} initialSaveCount={post.save_count ?? 0}
                commentCount={initialComments.length || post.comment_count} commentsHref="#comments"
                commentsLabel={(initialComments.length || post.comment_count) > 0 ? 'View comments' : 'Add a comment'}
                secondaryHref={openMediaHref} secondaryAriaLabel={post.media_type === 'video' ? 'Watch reel' : 'Open post'} />
              {post.caption ? <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-zinc-200"><Link href={authorProfileHref} className="mr-2 font-semibold text-white">{post.author?.username || 'Creator'}</Link>{post.caption}</p> : null}
              {categories.length ? <div className="mt-2 flex flex-wrap gap-1">{categories.map((category: any) => <Link key={category.id} href={'/explore?category=' + encodeURIComponent(category.slug)} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-violet-300 hover:bg-violet-500/10">{category.name}</Link>)}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
                <CopyPostLinkButton postId={post.id} />
                {isPostOwner ? <>
                  <Link href={'/post/' + post.id + '/edit'} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800">Edit post</Link>
                  <form action={deletePost}>
                    <input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="dev_profile_id" value={profileId} /><input type="hidden" name="return_to" value={returnTo} /><DeletePostButton />
                  </form>
                </> : null}
              </div>
              {!isPostOwner ? <div className="mt-3"><PostViewerControls postId={post.id} devProfileId={profileId} returnTo={returnTo} hiddenByViewer={moderationState.hiddenByViewer} reportedByViewer={moderationState.reportedByViewer} authorProfileHref={authorProfileHref} authorUsername={post.author?.username || 'Creator'} /></div> : null}
            </div>
          </div>
          <aside id="comments" className="min-w-0 scroll-mt-24 px-4 py-4" aria-label="Comments">
            <h2 className="mb-4 text-base font-semibold text-white">Comments</h2>
            {initialComments.length > 0 && isPostOwner ? <div className="space-y-4">
              {initialComments.map((comment: any) => <div key={comment.id} className="flex items-start gap-3 border-b border-zinc-800 pb-3">
                <div className="min-w-0 flex-1"><Link href={getProfileHref(comment.author?.id ?? comment.author_id, profileId)} className="text-sm font-semibold text-white">{comment.author?.username || 'User'}</Link>
                  <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-zinc-300">{comment.body}</p><p className="mt-2 text-xs text-zinc-400">{formatDate(comment.created_at)}</p>
                </div>
                <form action={deleteCommentByOwner}><input type="hidden" name="comment_id" value={comment.id} /><input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="dev_profile_id" value={profileId} /><input type="hidden" name="return_to" value={returnTo} /><DeleteCommentButton /></form>
              </div>)}
            </div> : null}
            {!isPostOwner ? <CommentThreadPanel postId={post.id} profileId={profileId} returnTo={returnTo} initialComments={initialComments} showAllComments postOwnerId={post.author_id} />
              : initialComments.length === 0 ? <p className="py-4 text-sm text-zinc-400">No comments yet.</p> : null}
          </aside>
        </div>
      </section>
      {relatedPosts.length > 0 ? <div className="mt-8"><FeedList posts={relatedPosts} devProfileId={profileId} emptyMode="explore" title={relatedTitle} subtitle="" returnToBase={returnTo} /></div> : null}
    </div>
  )
}
