import type { FeedBucket, FeedView } from '@/lib/recommendations/feed-contract'
import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { PostCard } from '@/components/feed/post-card'
import { getViewerPostModerationStates } from '@/lib/db/queries/post-moderation'

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
  devProfileId: string | null
  emptyMode?: 'feed' | 'explore'
  feedView?: FeedView
  title?: string
  subtitle?: string
  returnToBase?: string
}


export async function FeedList({ posts, devProfileId, emptyMode = 'feed', feedView = 'for-you', title, subtitle, returnToBase }: FeedListProps) {
  const followingView = emptyMode === 'feed' && feedView === 'following'
  // Membership can only narrow this view; never reorder or backfill it.
  const mainPosts = followingView ? posts.filter(post => post.source_bucket === 'following') : posts
  const baseReturnTo = returnToBase || (emptyMode === 'explore' ? '/explore' : '/feed')

  if (!mainPosts.length) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-10 text-center">
        <h2 className="text-lg font-semibold text-white">{followingView ? 'No posts from people you follow yet' : emptyMode === 'explore' ? 'No posts found' : 'No posts yet'}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">{followingView ? 'Find creators to follow in Explore.' : emptyMode === 'explore' ? 'Try another search or topic.' : 'Find creators to follow or share your first post.'}</p>
        <Link href="/explore" className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 hover:bg-zinc-800">Explore</Link>
      </section>
    )
  }

  const moderationStates = devProfileId ? await getViewerPostModerationStates(
    devProfileId,
    mainPosts.filter(post => post.author_id !== devProfileId).map(post => post.id)
  ) : new Map()

  return (
    <section aria-label={title || (emptyMode === 'explore' ? 'Discover posts' : 'Feed posts')} className="mx-auto w-full max-w-[640px]">
      {emptyMode === 'explore' ? <h2 className="mb-4 text-lg font-semibold text-white">{title || 'Discover posts'}</h2> : null}
      {subtitle ? <p className="mb-4 text-sm text-zinc-400">{subtitle}</p> : null}
      <div className="space-y-5">
        {mainPosts.map((post) => <PostCard key={post.id} post={post} devProfileId={devProfileId} returnTo={baseReturnTo} moderationState={moderationStates.get(post.id)} />)}
      </div>
    </section>
  )
}
