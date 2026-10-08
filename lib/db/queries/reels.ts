import { getFeedData } from '@/lib/db/queries/feed'
import type { CategoryJoin } from '@/lib/db/query-types'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { getVisiblePostSaveCounts } from '@/lib/db/queries/save-counts'
import { getHiddenPostIds } from '@/lib/db/queries/post-moderation'
import { filterDiscoveryPosts, getExploreData } from '@/lib/db/queries/explore'
import type { Tables } from '@/lib/supabase/database.types'

type ReelAuthor = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'avatar_url'>
type ReelBase = Pick<Tables<'posts'>,
  'id' | 'author_id' | 'caption' | 'media_type' | 'media_path' | 'thumbnail_path' | 'created_at'> & {
    post_categories?: CategoryJoin[]
    explore_score?: number
    feed_score?: number
    reason_labels?: string[]
    ranking_meta?: { engagement_score: number; follow_boost: number; category_boost: number; recency_boost: number }
  }
export type ReelPost = ReelBase & {
  media_url: string | null
  thumbnail_url: string | null
  like_count: number
  save_count: number
  comment_count: number
  liked_by_me: boolean
  saved_by_me: boolean
  author: ReelAuthor | null
}

type GetReelPageDataInput = {
  viewerProfileId: string
  postId: string
  source?: string
  sourceProfileId?: string | null
  activeCategory?: string | null
  searchQuery?: string | null
  feedView?: string | null
  feedPage?: number
}

function aggregateCountMap(rows: Array<{ post_id: string }> | null) {
  const counts = new Map<string, number>()
  for (const row of rows ?? []) counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1)
  return counts
}

export async function getReelPageData({
  viewerProfileId,
  postId,
  source = 'feed',
  sourceProfileId = null,
  activeCategory = null,
  searchQuery = null,
  feedView = null,
  feedPage = 1,
}: GetReelPageDataInput) {
  const supabase = await createClient()
  const empty = { reels: [] as ReelPost[], currentPostId: postId }
  const [currentResult, hiddenIds] = await Promise.all([
    supabase.from('posts')
      .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at, post_categories(category_id,categories(id,name,slug))')
      .eq('id', postId).eq('media_type', 'video').eq('status', 'published').eq('visibility', 'public').maybeSingle(),
    getHiddenPostIds(viewerProfileId),
  ])
  if (currentResult.error) throw new Error(currentResult.error.message)
  let current: ReelBase | null = currentResult.data
  if (!current || current.media_type !== 'video' || !current.media_path.trim() || hiddenIds.has(current.id)) {
    return empty
  }

  let related: ReelBase[] = []
  let ranked: Array<Omit<ReelPost, 'media_url' | 'thumbnail_url'>> | null = null
  if (source === 'feed' && feedView === 'following') {
    const feed = await getFeedData(viewerProfileId, { view: 'following', page: feedPage })
    const matches = feed.posts.filter(post => post.media_type === 'video')
    const matched = matches.find(post => post.id === current!.id)
    if (!matched) return empty
    current = matched
    ranked = [matched, ...matches.filter(post => post.id !== current!.id).slice(0, 12)]
  } else if (source === 'explore') {
    // The requested reel opens first; subsequent reels preserve the same ranked,
    // category/search-filtered discovery sequence. An empty scope stays empty.
    const discovery = await getExploreData(viewerProfileId, activeCategory?.trim() || undefined)
    const matches = filterDiscoveryPosts(discovery.posts, searchQuery ?? '')
      .filter((post) => post.media_type === 'video')
    const matched = matches.find((post) => post.id === current!.id)
    if (!matched) return empty
    current = matched
    ranked = [matched, ...matches.filter((post) => post.id !== current!.id).slice(0, 12)]
  } else {
    let query = supabase.from('posts')
      .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at, post_categories(category_id,categories(id,name,slug))')
      .eq('media_type', 'video').eq('status', 'published').eq('visibility', 'public').neq('id', current.id)
      .order('created_at', { ascending: false }).order('id', { ascending: true })
      .limit(12)
    if (hiddenIds.size) query = query.not('id', 'in', `(${[...hiddenIds].join(',')})`)

    if (source === 'profile' || source === 'post') {
      const authorId = source === 'profile' && sourceProfileId ? sourceProfileId : current.author_id
      if (current.author_id !== authorId) return empty
      query = query.eq('author_id', authorId)
    }
    if (source === 'saved') {
      const saved = await supabase.from('saves').select('post_id').eq('profile_id', viewerProfileId)
      if (saved.error) throw new Error(saved.error.message)
      const ids = (saved.data ?? []).map((row) => row.post_id)
      if (!ids.includes(current.id)) return empty
      query = query.in('id', ids)
    }
    const result = await query
    if (result.error) throw new Error(result.error.message)
    related = result.data ?? []
  }

  if (ranked) {
    // These scoped ranking queries already supply private-safe counts and author
    // data. Resolve media without fetching the same engagement rows again.
    return {
      reels: await Promise.all(ranked.map(async post => ({
        ...post,
        media_url: await getMediaUrl(post.media_path),
        thumbnail_url: await getMediaUrl(post.thumbnail_path),
      }))),
      currentPostId: postId,
    }
  }

  // Detail navigation intentionally pins the requested item. Other contexts use
  // newest-related order, never a broad replacement for a missing scoped result.
  const seen = new Set<string>()
  const ordered = [current, ...related].filter((post) => {
    if (seen.has(post.id) || hiddenIds.has(post.id) || !post.media_path.trim() || post.media_type !== 'video') return false
    seen.add(post.id)
    return true
  })
  const ids = ordered.map((post) => post.id)
  const authorIds = [...new Set(ordered.map((post) => post.author_id))]
  const [profiles, likes, saves, comments, viewerLikes, viewerSaves] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', authorIds),
    supabase.from('likes').select('post_id').in('post_id', ids),
    getVisiblePostSaveCounts(supabase, ids),
    supabase.from('comments').select('post_id').in('post_id', ids),
    supabase.from('likes').select('post_id').eq('profile_id', viewerProfileId).in('post_id', ids),
    supabase.from('saves').select('post_id').eq('profile_id', viewerProfileId).in('post_id', ids),
  ])
  for (const result of [profiles, likes, comments, viewerLikes, viewerSaves]) {
    if (result.error) throw new Error(result.error.message)
  }
  const authors = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]))
  const likeCounts = aggregateCountMap(likes.data)
  const commentCounts = aggregateCountMap(comments.data)
  const liked = new Set((viewerLikes.data ?? []).map((row) => row.post_id))
  const saved = new Set((viewerSaves.data ?? []).map((row) => row.post_id))
  const reels: ReelPost[] = await Promise.all(ordered.map(async (post) => ({
    ...post,
    media_url: await getMediaUrl(post.media_path),
    thumbnail_url: await getMediaUrl(post.thumbnail_path),
    like_count: likeCounts.get(post.id) ?? 0,
    save_count: saves.get(post.id) ?? 0,
    comment_count: commentCounts.get(post.id) ?? 0,
    liked_by_me: liked.has(post.id),
    saved_by_me: saved.has(post.id),
    author: authors.get(post.author_id) ?? null,
  })))
  return { reels, currentPostId: postId }
}
