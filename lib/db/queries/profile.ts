import { createClient } from '@/lib/supabase/server'

function normalizeNestedCategory(item: any) {
  const nested = Array.isArray(item?.categories)
    ? item.categories[0] ?? null
    : item?.categories ?? null

  return {
    category_id: item?.category_id ?? '',
    categories: nested
      ? {
          id: nested.id,
          name: nested.name,
          slug: nested.slug,
        }
      : null,
  }
}

function buildFallbackProfile(profileId: string) {
  const compact = String(profileId || 'unknown').slice(0, 8)

  return {
    id: profileId,
    username: compact.toLowerCase(),
    display_name: `Creator ${String(profileId || 'unknown').slice(0, 6)}`,
    bio: '',
    avatar_url: null,
  }
}

export async function getProfilePageData(
  viewerProfileId: string,
  profileId: string
) {
  const supabase = await createClient()

  const safeViewerId = String(viewerProfileId || '').trim()
  const safeProfileId = String(profileId || '').trim()
  const isOwnProfile = safeViewerId === safeProfileId

  const [
    profileResult,
    postsResult,
    savedCountResult,
    followerCountResult,
    followingCountResult,
    followedByMeResult,
    followsYouResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .eq('id', safeProfileId)
      .maybeSingle(),

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
        post_categories (
          category_id,
          categories (
            id,
            name,
            slug
          )
        ),
        likes (
          profile_id
        ),
        saves (
          profile_id
        ),
        comments (
          id,
          author_id,
          body,
          created_at
        )
      `)
      .eq('author_id', safeProfileId)
      .order('created_at', { ascending: false }),

    supabase
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', safeProfileId),

    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', safeProfileId),

    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', safeProfileId),

    isOwnProfile
      ? Promise.resolve({ data: null, error: null } as any)
      : supabase
          .from('follows')
          .select('follower_id, following_id')
          .eq('follower_id', safeViewerId)
          .eq('following_id', safeProfileId)
          .maybeSingle(),

    isOwnProfile
      ? Promise.resolve({ data: null, error: null } as any)
      : supabase
          .from('follows')
          .select('follower_id, following_id')
          .eq('follower_id', safeProfileId)
          .eq('following_id', safeViewerId)
          .maybeSingle(),
  ])

  if (profileResult.error) throw new Error(profileResult.error.message)
  if (postsResult.error) throw new Error(postsResult.error.message)
  if (savedCountResult.error) throw new Error(savedCountResult.error.message)
  if (followerCountResult.error) throw new Error(followerCountResult.error.message)
  if (followingCountResult.error) throw new Error(followingCountResult.error.message)
  if (followedByMeResult?.error) throw new Error(followedByMeResult.error.message)
  if (followsYouResult?.error) throw new Error(followsYouResult.error.message)

  const profile = profileResult.data ?? buildFallbackProfile(safeProfileId)
  const followedByMe = !isOwnProfile && !!followedByMeResult?.data
  const followsYou = !isOwnProfile && !!followsYouResult?.data
  const canMessage = followedByMe && followsYou

  const rawPosts = (postsResult.data ?? []).map((post: any) => {
    const likes = Array.isArray(post.likes) ? post.likes : []
    const saves = Array.isArray(post.saves) ? post.saves : []
    const comments = Array.isArray(post.comments) ? post.comments : []
    const categories = Array.isArray(post.post_categories)
      ? post.post_categories.map(normalizeNestedCategory)
      : []

    comments.sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return {
      ...post,
      like_count: likes.length,
      liked_by_me: likes.some((like: any) => like.profile_id === safeViewerId),
      save_count: saves.length,
      saved_by_me: saves.some((save: any) => save.profile_id === safeViewerId),
      comment_count: comments.length,
      comments,
      post_categories: categories,
      reason_labels: [],
    }
  })

  const profileIds = [
    profile.id,
    ...rawPosts.flatMap((post: any) => [
      post.author_id,
      ...(Array.isArray(post.comments)
        ? post.comments.map((comment: any) => comment.author_id)
        : []),
    ]),
  ].filter(Boolean)

  const uniqueProfileIds = [...new Set(profileIds)]
  let profileMap = new Map<string, any>()

  if (uniqueProfileIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .in('id', uniqueProfileIds)

    if (profilesError) throw new Error(profilesError.message)

    profileMap = new Map((profilesData ?? []).map((row: any) => [row.id, row]))
  }

  const resolvedProfile = profileMap.get(profile.id) ?? profile

  const posts = rawPosts.map((post: any) => ({
    ...post,
    author: profileMap.get(post.author_id) ?? null,
    comments: (post.comments ?? []).map((comment: any) => ({
      ...comment,
      author: profileMap.get(comment.author_id) ?? null,
    })),
  }))

  return {
    profile: {
      id: resolvedProfile.id,
      username:
        String(resolvedProfile.username || '').trim() ||
        String(resolvedProfile.id).slice(0, 8).toLowerCase(),
      display_name:
        String(resolvedProfile.display_name || '').trim() ||
        `Creator ${String(resolvedProfile.id).slice(0, 6)}`,
      bio: String(resolvedProfile.bio || '').trim(),
      avatar_url: resolvedProfile.avatar_url || null,
      is_own_profile: isOwnProfile,
      followed_by_me: followedByMe,
      follows_you: followsYou,
      can_message: canMessage,
    },
    stats: {
      post_count: posts.length,
      saved_count: savedCountResult.count ?? 0,
      follower_count: followerCountResult.count ?? 0,
      following_count: followingCountResult.count ?? 0,
    },
    posts,
  }
}