import { createClient } from '@/lib/supabase/server'
import { getVisiblePostSaveCounts } from '@/lib/db/queries/save-counts'
import { getHiddenPostIds } from '@/lib/db/queries/post-moderation'

type ExploreCategory = {
  id: string
  name: string
  slug: string
}

type CategoryPreferenceMap = Map<string, number>

function getRecencyBoost(createdAt: string) {
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  )

  if (ageHours <= 6) return 4
  if (ageHours <= 24) return 3
  if (ageHours <= 72) return 2
  if (ageHours <= 168) return 1

  return 0
}

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

function addCategoryWeights(
  target: CategoryPreferenceMap,
  postCategories: any[] | null | undefined,
  weight: number
) {
  const categories = Array.isArray(postCategories) ? postCategories : []

  for (const item of categories) {
    const nested = Array.isArray(item?.categories)
      ? item.categories[0] ?? null
      : item?.categories ?? null

    const slug = nested?.slug
    if (!slug) continue

    target.set(slug, (target.get(slug) ?? 0) + weight)
  }
}

function addSlugWeights(
  target: CategoryPreferenceMap,
  slugs: string[] | null | undefined,
  weight: number
) {
  for (const slug of Array.isArray(slugs) ? slugs : []) {
    if (!slug) continue
    target.set(slug, (target.get(slug) ?? 0) + weight)
  }
}

function getCategoryBoost(
  preferenceMap: CategoryPreferenceMap,
  postCategories: any[] | null | undefined
) {
  const categories = Array.isArray(postCategories) ? postCategories : []
  let boost = 0

  for (const item of categories) {
    const nested = Array.isArray(item?.categories)
      ? item.categories[0] ?? null
      : item?.categories ?? null

    const slug = nested?.slug
    if (!slug) continue

    boost += preferenceMap.get(slug) ?? 0
  }

  return boost
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

export async function getExploreData(
  devProfileId: string,
  categorySlug?: string
) {
  const supabase = await createClient()

  const [
    postsResult,
    followsResult,
    followerRowsResult,
    savedAffinityResult,
    likedAffinityResult,
    onboardingPreferenceResult,
    hiddenPostIds,
  ] = await Promise.all([
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
      `),

    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', devProfileId),

    supabase
      .from('follows')
      .select('following_id'),

    supabase
      .from('saves')
      .select(`
        post_id,
        posts (
          id,
          post_categories (
            category_id,
            categories (
              id,
              name,
              slug
            )
          )
        )
      `)
      .eq('profile_id', devProfileId),

    supabase
      .from('likes')
      .select(`
        post_id,
        posts (
          id,
          post_categories (
            category_id,
            categories (
              id,
              name,
              slug
            )
          )
        )
      `)
      .eq('profile_id', devProfileId),

    supabase
      .from('profile_category_preferences')
      .select(`
        category_id,
        categories (
          id,
          name,
          slug
        )
      `)
      .eq('profile_id', devProfileId),

    getHiddenPostIds(devProfileId),
  ])

  if (postsResult.error) throw new Error(postsResult.error.message)
  if (followsResult.error) throw new Error(followsResult.error.message)
  if (followerRowsResult.error) throw new Error(followerRowsResult.error.message)
  if (savedAffinityResult.error) throw new Error(savedAffinityResult.error.message)
  if (likedAffinityResult.error) throw new Error(likedAffinityResult.error.message)
  if (onboardingPreferenceResult.error) {
    throw new Error(onboardingPreferenceResult.error.message)
  }

  const saveCounts = await getVisiblePostSaveCounts(
    supabase,
    (postsResult.data ?? []).map((post: { id: string }) => post.id)
  )

  const followedAuthorIds = new Set(
    (followsResult.data ?? []).map((row: any) => row.following_id).filter(Boolean)
  )

  const preferenceMap: CategoryPreferenceMap = new Map()

  const onboardingSlugs = (onboardingPreferenceResult.data ?? [])
    .map((row: any) => {
      const nested = Array.isArray(row?.categories)
        ? row.categories[0] ?? null
        : row?.categories ?? null

      return nested?.slug ?? null
    })
    .filter(Boolean)

  addSlugWeights(preferenceMap, onboardingSlugs, 6)

  for (const row of savedAffinityResult.data ?? []) {
    const relatedPost = Array.isArray((row as any)?.posts)
      ? (row as any).posts[0] ?? null
      : (row as any)?.posts ?? null

    addCategoryWeights(preferenceMap, relatedPost?.post_categories, 3)
  }

  for (const row of likedAffinityResult.data ?? []) {
    const relatedPost = Array.isArray((row as any)?.posts)
      ? (row as any).posts[0] ?? null
      : (row as any)?.posts ?? null

    addCategoryWeights(preferenceMap, relatedPost?.post_categories, 2)
  }

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

    const likeCount = likes.length
    const saveCount = saveCounts.get(post.id) ?? 0
    const commentCount = comments.length

    const engagementScore = saveCount * 4 + likeCount * 2 + commentCount * 3
    const followBoost = followedAuthorIds.has(post.author_id) ? 3 : 0
    const categoryBoost = getCategoryBoost(preferenceMap, categories)
    const recencyBoost = getRecencyBoost(post.created_at)
    const exploreScore =
      engagementScore + followBoost + categoryBoost + recencyBoost

    return {
      ...post,
      like_count: likeCount,
      liked_by_me: likes.some((like: any) => like.profile_id === devProfileId),
      save_count: saveCount,
      saved_by_me: saves.some((save: any) => save.profile_id === devProfileId),
      comment_count: commentCount,
      comments,
      post_categories: categories,
      explore_score: exploreScore,
      ranking_meta: {
        engagement_score: engagementScore,
        follow_boost: followBoost,
        category_boost: categoryBoost,
        recency_boost: recencyBoost,
      },
    }
  })

  const visiblePosts = rawPosts.filter((post) => !hiddenPostIds.has(post.id))

  const profileIds = [
    ...visiblePosts.map((post) => post.author_id),
    ...visiblePosts.flatMap((post) =>
      (post.comments ?? []).map((comment: any) => comment.author_id)
    ),
  ].filter(Boolean)

  const uniqueProfileIds = [...new Set(profileIds)]

  let profileMap = new Map<string, any>()

  if (uniqueProfileIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .in('id', uniqueProfileIds)

    if (profilesError) throw new Error(profilesError.message)

    profileMap = new Map(
      (profilesData ?? []).map((profile: any) => [profile.id, profile])
    )
  }

  const posts = visiblePosts.map((post) => ({
    ...post,
    author: profileMap.get(post.author_id) ?? null,
    comments: (post.comments ?? []).map((comment: any) => ({
      ...comment,
      author: profileMap.get(comment.author_id) ?? null,
    })),
  }))

  const categoryMap = new Map<string, ExploreCategory>()

  for (const post of posts) {
    for (const item of post.post_categories ?? []) {
      const category = item?.categories
      if (!category?.slug) continue

      categoryMap.set(category.slug, {
        id: category.id,
        name: category.name,
        slug: category.slug,
      })
    }
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const filteredPosts = categorySlug
    ? posts.filter((post) =>
        (post.post_categories ?? []).some(
          (item: any) => item?.categories?.slug === categorySlug
        )
      )
    : posts

  filteredPosts.sort((a, b) => {
    if (b.explore_score !== a.explore_score) return b.explore_score - a.explore_score
    if (b.save_count !== a.save_count) return b.save_count - a.save_count
    if (b.comment_count !== a.comment_count) return b.comment_count - a.comment_count
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const creatorSourcePosts = filteredPosts.filter(
    (post) => post.author_id && post.author_id !== devProfileId
  )

  const creatorAggregate = new Map<
    string,
    {
      id: string
      post_count: number
      follower_count: number
      followed_by_me: boolean
      latest_post_at: string
      engagement_score: number
      category_score: number
      discovery_score: number
      matched_categories: Array<{ name: string; slug: string }>
      matched_category_slugs: Set<string>
    }
  >()

  for (const row of followerRowsResult.data ?? []) {
    const creatorId = row?.following_id
    if (!creatorId) continue

    const current = creatorAggregate.get(creatorId)

    if (current) {
      current.follower_count += 1
    } else {
      creatorAggregate.set(creatorId, {
  id: creatorId,
  post_count: 0,
  follower_count: 1,
  followed_by_me: followedAuthorIds.has(creatorId),
  latest_post_at: '',
  engagement_score: 0,
  category_score: 0,
  discovery_score: 0,
  matched_categories: [] as Array<{ name: string; slug: string }>,
  matched_category_slugs: new Set<string>(),
})
    }
  }

  for (const post of creatorSourcePosts) {
   const current =
  creatorAggregate.get(post.author_id) ??
  {
    id: post.author_id,
    post_count: 0,
    follower_count: 0,
    followed_by_me: followedAuthorIds.has(post.author_id),
    latest_post_at: '',
    engagement_score: 0,
    category_score: 0,
    discovery_score: 0,
    matched_categories: [] as Array<{ name: string; slug: string }>,
    matched_category_slugs: new Set<string>(),
  }

    current.post_count += 1
    current.engagement_score += post.like_count * 2 + post.save_count * 4 + post.comment_count * 3

    if (!current.latest_post_at) {
      current.latest_post_at = post.created_at
    } else if (
      new Date(post.created_at).getTime() > new Date(current.latest_post_at).getTime()
    ) {
      current.latest_post_at = post.created_at
    }

    for (const item of post.post_categories ?? []) {
      const category = item?.categories
      const slug = category?.slug
      if (!slug) continue

      const preferenceWeight = preferenceMap.get(slug) ?? 0
      const activeCategoryWeight = categorySlug && slug === categorySlug ? 8 : 0
      const totalWeight = preferenceWeight + activeCategoryWeight

      if (totalWeight > 0) {
        current.category_score += totalWeight

        if (!current.matched_category_slugs.has(slug)) {
          current.matched_category_slugs.add(slug)
          current.matched_categories.push({
            name: category.name,
            slug,
          })
        }
      }
    }

    creatorAggregate.set(post.author_id, current)
  }

  const creatorIds = Array.from(creatorAggregate.keys())

  const creators = creatorIds
    .map((creatorId) => {
      const profile = profileMap.get(creatorId) ?? buildFallbackProfile(creatorId)
      const aggregate = creatorAggregate.get(creatorId)

      if (!aggregate) return null

      const recencyBoost = aggregate.latest_post_at
        ? getRecencyBoost(aggregate.latest_post_at) * 3
        : 0

      const notFollowingBoost = aggregate.followed_by_me ? 0 : 6

      aggregate.discovery_score =
        aggregate.category_score + aggregate.engagement_score + recencyBoost + notFollowingBoost

      return {
        id: profile.id,
        username:
          String(profile.username || '').trim() ||
          String(profile.id).slice(0, 8).toLowerCase(),
        display_name:
          String(profile.display_name || '').trim() ||
          `Creator ${String(profile.id).slice(0, 6)}`,
        bio: String(profile.bio || '').trim(),
        avatar_url: profile.avatar_url || null,
        followed_by_me: aggregate.followed_by_me,
        follower_count: aggregate.follower_count,
        post_count: aggregate.post_count,
        latest_post_at: aggregate.latest_post_at,
        discovery_score: aggregate.discovery_score,
        matched_categories: aggregate.matched_categories.slice(0, 3),
      }
    })
    .filter(Boolean) as Array<{
    id: string
    username: string
    display_name: string
    bio: string
    avatar_url: string | null
    followed_by_me: boolean
    follower_count: number
    post_count: number
    latest_post_at: string
    discovery_score: number
    matched_categories: Array<{ name: string; slug: string }>
  }>

  creators.sort((a, b) => {
    if (a.followed_by_me !== b.followed_by_me) {
      return a.followed_by_me ? 1 : -1
    }

    if (b.discovery_score !== a.discovery_score) {
      return b.discovery_score - a.discovery_score
    }

    if (b.post_count !== a.post_count) {
      return b.post_count - a.post_count
    }

    if (b.follower_count !== a.follower_count) {
      return b.follower_count - a.follower_count
    }

    return a.display_name.localeCompare(b.display_name)
  })

  return {
    posts: filteredPosts,
    categories,
    creators: creators.slice(0, 6),
  }
}