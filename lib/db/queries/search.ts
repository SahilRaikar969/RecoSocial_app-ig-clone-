import type { Tables } from '@/lib/supabase/database.types'
import { getVisiblePostSaveCounts } from '@/lib/db/queries/save-counts'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { getHiddenPostIds } from '@/lib/db/queries/post-moderation'

type RawProfile = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'bio' | 'avatar_url'>

type RawPost = {
  id: string
  author_id: string
  caption: string | null
  media_type: string
  media_path: string
  thumbnail_path: string | null
  created_at: string
  like_count?: number
  comment_count?: number
  save_count?: number
  author?: RawProfile | null
}

function normalizeText(value: string) {
  return String(value || '').trim().toLowerCase()
}

function scoreProfile(profile: RawProfile, query: string) {
  const q = normalizeText(query)
  const username = normalizeText(profile.username || '')
  const displayName = normalizeText(profile.display_name || '')
  const bio = normalizeText(profile.bio || '')

  let score = 0

  if (username === q) score += 120
  if (displayName === q) score += 90

  if (username.startsWith(q)) score += 70
  if (displayName.startsWith(q)) score += 50

  if (username.includes(q)) score += 25
  if (displayName.includes(q)) score += 20
  if (bio.includes(q)) score += 8

  return score
}

function scorePost(post: RawPost, query: string) {
  const q = normalizeText(query)
  const caption = normalizeText(post.caption || '')
  const username = normalizeText(post.author?.username || '')
  const displayName = normalizeText(post.author?.display_name || '')

  let score = 0

  if (caption.includes(q)) score += 20
  if (username.includes(q)) score += 16
  if (displayName.includes(q)) score += 12

  const engagementBoost =
    (post.like_count ?? 0) * 2 +
    (post.comment_count ?? 0) * 3 +
    (post.save_count ?? 0) * 4

  return score + engagementBoost
}

function dedupePostsById<T extends { id: string }>(posts: T[]) {
  const map = new Map<string, T>()

  for (const post of posts) {
    if (!post?.id) continue
    map.set(post.id, post)
  }

  return Array.from(map.values())
}

export async function getSearchData(viewerProfileId: string, query: string) {
  const supabase = await createClient()
  const safeQuery = String(query || '').trim()

  if (!safeQuery) {
    return {
      creators: [],
      posts: [],
      query: '',
    }
  }

  const [
    { data: profiles, error: profilesError },
    { data: captionPosts, error: captionPostsError },
    { data: follows, error: followsError },
    hiddenPostIds,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .or(
        `username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%,bio.ilike.%${safeQuery}%`
      )
      .limit(20),

    supabase
      .from('posts')
      .select(`
        id,
        author_id,
        caption,
        media_type,
        media_path,
        thumbnail_path,
        created_at,
        likes (
          profile_id
        ),
        comments (
          id
        ),
        saves (
          profile_id
        )
      `)
      .ilike('caption', `%${safeQuery}%`)
      .limit(24),

    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', viewerProfileId),

    getHiddenPostIds(viewerProfileId),
  ])

  if (profilesError) throw new Error(profilesError.message)
  if (captionPostsError) throw new Error(captionPostsError.message)
  if (followsError) throw new Error(followsError.message)

  const followedIds = new Set(
    (follows ?? []).map((row) => row.following_id).filter(Boolean)
  )

  const matchedCreatorIds = (profiles ?? [])
    .map((profile: RawProfile) => profile.id)
    .filter(Boolean)

  let authorMatchPosts: NonNullable<typeof captionPosts> = []

  if (matchedCreatorIds.length > 0) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        author_id,
        caption,
        media_type,
        media_path,
        thumbnail_path,
        created_at,
        likes (
          profile_id
        ),
        comments (
          id
        ),
        saves (
          profile_id
        )
      `)
      .in('author_id', matchedCreatorIds)
      .limit(24)

    if (error) throw new Error(error.message)
    authorMatchPosts = data ?? []
  }

  const mergedPosts = dedupePostsById([
    ...(captionPosts ?? []),
    ...authorMatchPosts,
  ]).filter((post) => !hiddenPostIds.has(post.id))

  const saveCounts = await getVisiblePostSaveCounts(supabase, mergedPosts.map((post) => post.id))

  const authorIds = [
    ...new Set(mergedPosts.map((post) => post.author_id).filter(Boolean)),
  ]

  let authorMap = new Map<string, RawProfile>()

  if (authorIds.length > 0) {
    const { data: authors, error: authorsError } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .in('id', authorIds)

    if (authorsError) throw new Error(authorsError.message)

    authorMap = new Map((authors ?? []).map((author) => [author.id, author]))
  }

  const creatorIdsForStats = (profiles ?? [])
    .map((profile: RawProfile) => profile.id)
    .filter((id) => id && id !== viewerProfileId)

  const [followerRowsResult, creatorPostsResult] =
    creatorIdsForStats.length > 0
      ? await Promise.all([
          supabase
            .from('follows')
            .select('following_id')
            .in('following_id', creatorIdsForStats),

          supabase
            .from('posts')
            .select('author_id')
            .in('author_id', creatorIdsForStats),
        ])
      : [
          { data: [], error: null } as const,
          { data: [], error: null } as const,
        ]

  if (followerRowsResult.error) throw new Error(followerRowsResult.error.message)
  if (creatorPostsResult.error) throw new Error(creatorPostsResult.error.message)

  const followerCountMap = new Map<string, number>()
  const postCountMap = new Map<string, number>()

  for (const row of followerRowsResult.data ?? []) {
    const creatorId = row?.following_id
    if (!creatorId) continue
    followerCountMap.set(creatorId, (followerCountMap.get(creatorId) ?? 0) + 1)
  }

  for (const row of creatorPostsResult.data ?? []) {
    const creatorId = row?.author_id
    if (!creatorId) continue
    postCountMap.set(creatorId, (postCountMap.get(creatorId) ?? 0) + 1)
  }

  const creatorResults = await Promise.all(
    (profiles ?? [])
      .filter((profile: RawProfile) => profile.id !== viewerProfileId)
      .map(async (profile: RawProfile) => ({
        ...profile,
        avatar_resolved_url: await getMediaUrl(profile.avatar_url ?? null),
        followed_by_me: followedIds.has(profile.id),
        follower_count: followerCountMap.get(profile.id) ?? 0,
        post_count: postCountMap.get(profile.id) ?? 0,
        score:
          scoreProfile(profile, safeQuery) +
          (followedIds.has(profile.id) ? 6 : 0) +
          (postCountMap.get(profile.id) ?? 0) * 2 +
          (followerCountMap.get(profile.id) ?? 0),
      }))
  )

  creatorResults.sort((a, b) => {
    if (a.followed_by_me !== b.followed_by_me) return a.followed_by_me ? 1 : -1
    if (b.score !== a.score) return b.score - a.score
    return String(a.username || '').localeCompare(String(b.username || ''))
  })

  const postResults = await Promise.all(
    mergedPosts.map(async (post) => {
      const author = authorMap.get(post.author_id) ?? null
      const likeCount = Array.isArray(post.likes) ? post.likes.length : 0
      const commentCount = Array.isArray(post.comments) ? post.comments.length : 0
      const saveCount = saveCounts.get(post.id) ?? 0

      return {
        id: post.id,
        author_id: post.author_id,
        caption: post.caption,
        media_type: post.media_type,
        media_path: post.media_path,
        thumbnail_path: post.thumbnail_path,
        created_at: post.created_at,
        like_count: likeCount,
        comment_count: commentCount,
        save_count: saveCount,
        media_resolved_url: await getMediaUrl(post.media_path),
        thumbnail_resolved_url: await getMediaUrl(post.thumbnail_path ?? null),
        author: author
          ? {
              ...author,
              avatar_resolved_url: await getMediaUrl(author.avatar_url ?? null),
            }
          : null,
        score: scorePost(
          {
            ...post,
            like_count: likeCount,
            comment_count: commentCount,
            save_count: saveCount,
            author,
          },
          safeQuery
        ),
      }
    })
  )

  postResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return {
    query: safeQuery,
    creators: creatorResults.slice(0, 8),
    posts: postResults.slice(0, 12),
  }
}