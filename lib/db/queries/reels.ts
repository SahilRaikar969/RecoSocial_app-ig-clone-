import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'

type ReelAuthor = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export type ReelPost = {
  id: string
  author_id: string
  caption: string | null
  media_type: string
  media_path: string
  thumbnail_path: string | null
  media_url: string | null
  thumbnail_url: string | null
  created_at: string
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
}

async function getAuthorMap(authorIds: string[]) {
  const supabase = await createClient()

  if (!authorIds.length) {
    return new Map<string, ReelAuthor>()
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', authorIds)

  return new Map(
    (data || []).map((row: any) => [
      row.id,
      {
        id: row.id,
        username: row.username ?? null,
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
      },
    ])
  )
}

function aggregateCountMap(rows: Array<{ post_id: string }> | null | undefined) {
  const map = new Map<string, number>()

  for (const row of rows || []) {
    map.set(row.post_id, (map.get(row.post_id) || 0) + 1)
  }

  return map
}

export async function getReelPageData({
  viewerProfileId,
  postId,
  source = 'feed',
  activeCategory = null,
  searchQuery = null,
}: GetReelPageDataInput) {
  const supabase = await createClient()

  const { data: currentPost, error: currentPostError } = await supabase
    .from('posts')
    .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
    .eq('id', postId)
    .eq('media_type', 'video')
    .maybeSingle()

  if (currentPostError || !currentPost) {
    return {
      reels: [] as ReelPost[],
      currentPostId: postId,
    }
  }

  let candidateQuery = supabase
    .from('posts')
    .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
    .eq('media_type', 'video')
    .neq('id', postId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (source === 'profile' && currentPost.author_id) {
    candidateQuery = candidateQuery.eq('author_id', currentPost.author_id)
  }

  if (source === 'explore' && activeCategory) {
    const { data: categoryRows } = await supabase
      .from('post_categories')
      .select('post_id, categories!inner(slug)')
      .eq('categories.slug', activeCategory)

    const categoryPostIds = (categoryRows || [])
      .map((row: any) => row.post_id)
      .filter(Boolean)
      .filter((id: string) => id !== postId)

    if (categoryPostIds.length) {
      candidateQuery = supabase
        .from('posts')
        .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
        .eq('media_type', 'video')
        .in('id', categoryPostIds)
        .order('created_at', { ascending: false })
        .limit(10)
    }
  }

  if (source === 'saved') {
    const { data: savedRows } = await supabase
      .from('saves')
      .select('post_id')
      .eq('profile_id', viewerProfileId)

    const savedPostIds = (savedRows || [])
      .map((row: any) => row.post_id)
      .filter(Boolean)
      .filter((id: string) => id !== postId)

    if (savedPostIds.length) {
      candidateQuery = supabase
        .from('posts')
        .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
        .eq('media_type', 'video')
        .in('id', savedPostIds)
        .order('created_at', { ascending: false })
        .limit(10)
    }
  }

  if (source === 'post' && currentPost.author_id) {
    candidateQuery = candidateQuery.eq('author_id', currentPost.author_id)
  }

  const { data: candidatePosts } = await candidateQuery

  let reelsBase = [currentPost, ...(candidatePosts || [])]

  if (source !== 'profile' && source !== 'saved' && source !== 'explore' && searchQuery?.trim()) {
    const lowered = searchQuery.trim().toLowerCase()
    reelsBase = reelsBase.filter(
      (row) =>
        row.id === postId ||
        String(row.caption || '').toLowerCase().includes(lowered)
    )
  }

  const uniqueReels = Array.from(
    new Map(reelsBase.map((row) => [row.id, row])).values()
  )

  const reelIds = uniqueReels.map((row) => row.id)
  const authorIds = Array.from(new Set(uniqueReels.map((row) => row.author_id).filter(Boolean)))

  const [authorMap, likeRows, saveRows, likedRows, savedRows, commentRows] =
    await Promise.all([
      getAuthorMap(authorIds),
      supabase.from('likes').select('post_id').in('post_id', reelIds),
      supabase.from('saves').select('post_id').in('post_id', reelIds),
      supabase
        .from('likes')
        .select('post_id')
        .eq('profile_id', viewerProfileId)
        .in('post_id', reelIds),
      supabase
        .from('saves')
        .select('post_id')
        .eq('profile_id', viewerProfileId)
        .in('post_id', reelIds),
      supabase.from('comments').select('post_id').in('post_id', reelIds),
    ])

  const likeCountMap = aggregateCountMap(likeRows.data as Array<{ post_id: string }>)
  const saveCountMap = aggregateCountMap(saveRows.data as Array<{ post_id: string }>)
  const commentCountMap = aggregateCountMap(commentRows.data as Array<{ post_id: string }>)

  const likedSet = new Set((likedRows.data || []).map((row: any) => row.post_id))
  const savedSet = new Set((savedRows.data || []).map((row: any) => row.post_id))

  const reels: ReelPost[] = await Promise.all(
    uniqueReels.map(async (row) => ({
      id: row.id,
      author_id: row.author_id,
      caption: row.caption ?? null,
      media_type: row.media_type,
      media_path: row.media_path,
      thumbnail_path: row.thumbnail_path ?? null,
      media_url: await getMediaUrl(row.media_path),
      thumbnail_url: await getMediaUrl(row.thumbnail_path ?? null),
      created_at: row.created_at,
      like_count: likeCountMap.get(row.id) || 0,
      save_count: saveCountMap.get(row.id) || 0,
      comment_count: commentCountMap.get(row.id) || 0,
      liked_by_me: likedSet.has(row.id),
      saved_by_me: savedSet.has(row.id),
      author: authorMap.get(row.author_id) || null,
    }))
  )

  return {
    reels,
    currentPostId: postId,
  }
}