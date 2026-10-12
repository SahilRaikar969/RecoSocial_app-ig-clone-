import type { PublicProfile } from '@/lib/db/query-types'
import { createClient } from '@/lib/supabase/server'

type NetworkMode = 'followers' | 'following'

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function scoreProfileMatch(profile: PublicProfile, searchQuery: string) {
  const q = normalizeText(searchQuery)

  if (!q) return 0

  const username = normalizeText(profile.username)
  const displayName = normalizeText(profile.display_name)
  const bio = normalizeText(profile.bio)

  let score = 0

  if (username === q) score += 100
  if (displayName === q) score += 80

  if (username.startsWith(q)) score += 45
  if (displayName.startsWith(q)) score += 35

  if (username.includes(q)) score += 18
  if (displayName.includes(q)) score += 14
  if (bio.includes(q)) score += 6

  return score
}

export async function getProfileNetworkPageData(
  viewerProfileId: string,
  targetProfileId: string,
  mode: NetworkMode,
  searchQuery?: string
) {
  const supabase = await createClient()
  const normalizedSearch = String(searchQuery || '').trim().toLowerCase()

  const targetColumn = mode === 'followers' ? 'follower_id' : 'following_id'
  const filterColumn = mode === 'followers' ? 'following_id' : 'follower_id'

  const { data: relationRows, error: relationError } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .eq(filterColumn, targetProfileId)

  if (relationError) {
    throw new Error(relationError.message)
  }

  const profileIds = (relationRows ?? [])
    .map((row) => row[targetColumn])
    .filter(Boolean)

  if (!profileIds.length) {
    return {
      profiles: [],
      summary: {
        total: 0,
        mutual_count: 0,
        following_count: 0,
        follows_you_count: 0,
        creator_count: 0,
      },
    }
  }

  const uniqueProfileIds = [...new Set(profileIds)]

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .in('id', uniqueProfileIds)

  if (profilesError) {
    throw new Error(profilesError.message)
  }

  const { data: followedRows, error: followedError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewerProfileId)
    .in('following_id', uniqueProfileIds)

  if (followedError) {
    throw new Error(followedError.message)
  }

  const { data: followsYouRows, error: followsYouError } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', viewerProfileId)
    .in('follower_id', uniqueProfileIds)

  if (followsYouError) {
    throw new Error(followsYouError.message)
  }

  const { data: followerCountRows, error: followerCountError } = await supabase
    .from('follows')
    .select('following_id')
    .in('following_id', uniqueProfileIds)

  if (followerCountError) {
    throw new Error(followerCountError.message)
  }

  const { data: postCountRows, error: postCountError } = await supabase
    .from('posts')
    .select('author_id')
    .in('author_id', uniqueProfileIds)

  if (postCountError) {
    throw new Error(postCountError.message)
  }

  const followedSet = new Set(
    (followedRows ?? []).map((row) => row.following_id).filter(Boolean)
  )

  const followsYouSet = new Set(
    (followsYouRows ?? []).map((row) => row.follower_id).filter(Boolean)
  )

  const followerCountMap = new Map<string, number>()
  const postCountMap = new Map<string, number>()

  for (const row of followerCountRows ?? []) {
    const profileId = row?.following_id
    if (!profileId) continue
    followerCountMap.set(profileId, (followerCountMap.get(profileId) ?? 0) + 1)
  }

  for (const row of postCountRows ?? []) {
    const profileId = row?.author_id
    if (!profileId) continue
    postCountMap.set(profileId, (postCountMap.get(profileId) ?? 0) + 1)
  }

  const filteredProfiles = (profilesData ?? []).filter((profile: PublicProfile) => {
    if (!normalizedSearch) return true

    const username = normalizeText(profile.username)
    const displayName = normalizeText(profile.display_name)
    const bio = normalizeText(profile.bio)

    return (
      username.includes(normalizedSearch) ||
      displayName.includes(normalizedSearch) ||
      bio.includes(normalizedSearch)
    )
  })

  const enrichedProfiles = filteredProfiles
    .map((profile: PublicProfile) => {
      const isViewer = profile.id === viewerProfileId
      const followedByMe = followedSet.has(profile.id)
      const followsYou = followsYouSet.has(profile.id)
      const isMutual = followedByMe && followsYou
      const followerCount = followerCountMap.get(profile.id) ?? 0
      const postCount = postCountMap.get(profile.id) ?? 0

      const baseSearchScore = scoreProfileMatch(profile, normalizedSearch)
      const relationshipBoost = isMutual ? 24 : followedByMe ? 12 : followsYou ? 10 : 0
      const creatorBoost = followerCount + postCount * 2
      const viewerPenalty = isViewer ? -10 : 0

      return {
        id: profile.id,
        username: profile.username || 'creator',
        display_name: profile.display_name || profile.username || 'Creator',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url,
        is_viewer: isViewer,
        followed_by_me: followedByMe,
        follows_you: followsYou,
        is_mutual: isMutual,
        follower_count: followerCount,
        post_count: postCount,
        rank_score: baseSearchScore + relationshipBoost + creatorBoost + viewerPenalty,
      }
    })
    .sort((a, b) => {
      if (a.is_viewer !== b.is_viewer) return a.is_viewer ? -1 : 1
      if (b.rank_score !== a.rank_score) return b.rank_score - a.rank_score
      if (b.follower_count !== a.follower_count) return b.follower_count - a.follower_count
      if (b.post_count !== a.post_count) return b.post_count - a.post_count
      return a.username.localeCompare(b.username)
    })

  return {
    profiles: enrichedProfiles,
    summary: {
      total: enrichedProfiles.length,
      mutual_count: enrichedProfiles.filter((profile) => profile.is_mutual && !profile.is_viewer).length,
      following_count: enrichedProfiles.filter((profile) => profile.followed_by_me && !profile.is_viewer).length,
      follows_you_count: enrichedProfiles.filter((profile) => profile.follows_you && !profile.is_viewer).length,
      creator_count: enrichedProfiles.filter((profile) => (profile.post_count ?? 0) > 0 && !profile.is_viewer).length,
    },
  }
}