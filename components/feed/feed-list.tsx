import type { FeedBucket, FeedView } from '@/lib/recommendations/feed-contract'
import Link from 'next/link'
import { PostCard } from '@/components/feed/post-card'

type FeedPost = {
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
  comments?: Array<{
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
  }>
  post_categories?: Array<{
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
  }>
  explore_score?: number
  feed_score?: number
  reason_labels?: string[]
  source_bucket?: FeedBucket
}

type FeedListProps = {
  posts: FeedPost[]
  devProfileId: string
  emptyMode?: 'feed' | 'explore'
  feedView?: FeedView
  title?: string
  subtitle?: string
  returnToBase?: string
}

function getEmptyCopy(mode: 'feed' | 'explore') {
  if (mode === 'explore') {
    return {
      eyebrow: 'Discovery empty',
      title: 'No discovery posts yet',
      body: 'Try a different search or category to reopen a wider discovery surface.',
    }
  }

  return {
    eyebrow: 'Feed empty',
    title: 'No feed posts yet',
    body: 'Follow creators, publish posts, and interact with content to give the home feed stronger ranking signals.',
  }
}

function SectionHeader({
  eyebrow,
  title,
  body,
  count,
}: {
  eyebrow: string
  title: string
  body: string
  count: number
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          {eyebrow}
        </div>

        <div className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {count} posts
        </div>
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">{body}</p>
    </div>
  )
}

export async function FeedList({
  posts,
  devProfileId,
  emptyMode = 'feed',
  feedView = 'for-you',
  title,
  subtitle,
  returnToBase,
}: FeedListProps) {
  const followingView = emptyMode === 'feed' && feedView === 'following'
  // Membership can only narrow this view; never reorder or backfill it.
  const mainPosts = followingView ? posts.filter(post => post.source_bucket === 'following') : posts
  const copy = followingView ? {
    eyebrow: 'Following', title: 'No posts from followed creators yet',
    body: 'Follow creators to see their public posts here. Broader recommendations are available in For You.',
  } : getEmptyCopy(emptyMode)
  const resolvedTitle =
    title || (emptyMode === 'explore' ? 'Discovery posts' : 'Recommended posts')
  const resolvedSubtitle =
    subtitle ||
    (emptyMode === 'explore'
      ? 'Ranked content from the current search and category surface.'
      : 'Ranked using follows, selected interests, likes and saves, with aggregate engagement and post recency.')

  const baseReturnTo =
    returnToBase || (emptyMode === 'explore' ? '/explore' : '/feed')

  if (!mainPosts.length) {
    return (
      <section className="rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            {copy.eyebrow}
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {copy.title}
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            {copy.body}
          </p>
        </div>

        <div className="px-5 py-8 sm:px-6">
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-800 bg-zinc-950/80 px-6 text-center">
            <div className="rounded-full border border-zinc-800 bg-black px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Nothing yet
            </div>

            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-400">
              {emptyMode === 'explore'
                ? 'Try a different search or category to widen the discovery surface.'
                : 'Explore more content, follow creators, and save posts to improve your home feed.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/explore"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Explore
              </Link>

              <Link
                href="/profile"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open profile
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[32px] border border-zinc-800/90 bg-black">
      <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              {emptyMode === 'explore' ? 'Discovery' : 'Feed'}
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              {resolvedTitle}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              {resolvedSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              {mainPosts.length} posts
            </span>

            <Link
              href="/saved"
              className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Saved
            </Link>

            <Link
              href="/activity"
              className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Activity
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[720px] px-3 py-5 sm:px-5 sm:py-6">
        {mainPosts.length ? (
          <section>
            {emptyMode === 'feed' ? (
              <SectionHeader
                eyebrow={followingView ? 'Following' : 'For you'}
                title={followingView ? 'From creators you follow' : 'Personalized posts'}
                body={followingView ? 'Only followed creators, in ranked order. No broader fallback posts.' : 'All eligible candidates compete in one ranked list. Follows and category interests influence their order.'}
                count={mainPosts.length}
              />
            ) : (
              <SectionHeader
                eyebrow="Explore results"
                title={resolvedTitle}
                body={resolvedSubtitle}
                count={mainPosts.length}
              />
            )}

            <div className="space-y-8">
              {mainPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  devProfileId={devProfileId}
                  returnTo={baseReturnTo}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  )
}