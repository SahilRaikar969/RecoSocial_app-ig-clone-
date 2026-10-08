import { createClient } from '@/lib/supabase/server'
import { getVisiblePostSaveCounts } from '@/lib/db/queries/save-counts'
import { getHiddenPostIds } from '@/lib/db/queries/post-moderation'

type CategoryPreferenceMap = Map<string, number>

type FeedCategory = {
  id: string
  name: string
  slug: string
}

type FeedSummary = {
  followedCreatorCount: number
  hiddenPostCount: number
  topInterestCategories: FeedCategory[]
  recommendationMix: {
    fromFollowing: number
    byInterest: number
    trending: number
  }
}

function getRecencyBoost(createdAt: string) {
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  )

  if (ageHours <= 6) return 3
  if (ageHours <= 24) return 2
  if (ageHours <= 72) return 1

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

function getMatchingCategories(
  preferenceMap: CategoryPreferenceMap,
  postCategories: Array<{
    category_id: string
    categories?: {
      id: string
      name: string
      slug: string
    } | null
  }>
) {
  return postCategories
    .map((item) => item.categories)
    .filter(
      (category): category is { id: string; name: string; slug: string } =>
        !!category?.slug && (preferenceMap.get(category.slug) ?? 0) > 0
    )
    .sort(
      (a, b) =>
        (preferenceMap.get(b.slug) ?? 0) - (preferenceMap.get(a.slug) ?? 0)
    )
    .slice(0, 3)
}

function buildReasonLabels(params: {
  fromFollowing: boolean
  matchingCategories: Array<{ id: string; name: string; slug: string }>
  likeCount: number
  saveCount: number
  commentCount: number
  recencyBoost: number
}) {
  const labels: string[] = []

  if (params.fromFollowing) {
    labels.push('From creators you follow')
  }

  for (const category of params.matchingCategories.slice(0, 2)) {
    labels.push(`Because you like ${category.name}`)
  }

  if (params.saveCount >= 2) {
    labels.push('Saved by others')
  }

  if (params.commentCount >= 2) {
    labels.push('Conversation momentum')
  }

  if (params.likeCount >= 4) {
    labels.push('Strong engagement')
  }

  if (params.recencyBoost >= 2) {
    labels.push('Fresh post')
  }

  return [...new Set(labels)].slice(0, 3)
}

export async function getFeedData(
  viewerProfileId: string
): Promise<{
  posts: any[]
  summary: FeedSummary
}> {
  const supabase = await createClient()

  const hiddenPostIds = await getHiddenPostIds(viewerProfileId)

  const [
    { data: allPosts, error: postsError },
    { data: follows, error: followsError },
    { data: savedRows, error: savedError },
    { data: likedRows, error: likedError },
    { data: onboardingRows, error: onboardingError },
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
        profiles!posts_author_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
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
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(80),

    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', viewerProfileId),

    supabase
      .from('saves')
      .select(`
        post_id,
        posts (
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
      .eq('profile_id', viewerProfileId),

    supabase
      .from('likes')
      .select(`
        post_id,
        posts (
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
      .eq('profile_id', viewerProfileId),

    supabase
      .from('profile_category_preferences')
      .select(`
        categories (
          id,
          name,
          slug
        )
      `)
      .eq('profile_id', viewerProfileId),
  ])

  if (postsError) throw new Error(postsError.message)
  if (followsError) throw new Error(followsError.message)
  if (savedError) throw new Error(savedError.message)
  if (likedError) throw new Error(likedError.message)
  if (onboardingError) throw new Error(onboardingError.message)

  const saveCounts = await getVisiblePostSaveCounts(
    supabase,
    (allPosts ?? []).map((post: { id: string }) => post.id)
  )

  const followedCreatorIds = new Set(
    (follows ?? []).map((row: any) => row.following_id).filter(Boolean)
  )

  const preferenceMap: CategoryPreferenceMap = new Map()

  for (const row of onboardingRows ?? []) {
    const category = Array.isArray((row as any)?.categories)
      ? (row as any).categories[0] ?? null
      : (row as any)?.categories ?? null

    if (!category?.slug) continue
    preferenceMap.set(category.slug, (preferenceMap.get(category.slug) ?? 0) + 8)
  }

  for (const row of savedRows ?? []) {
    const post = Array.isArray((row as any)?.posts)
      ? (row as any).posts[0] ?? null
      : (row as any)?.posts ?? null

    addCategoryWeights(preferenceMap, post?.post_categories, 5)
  }

  for (const row of likedRows ?? []) {
    const post = Array.isArray((row as any)?.posts)
      ? (row as any).posts[0] ?? null
      : (row as any)?.posts ?? null

    addCategoryWeights(preferenceMap, post?.post_categories, 3)
  }

  const normalizedPosts = (allPosts ?? [])
    .filter((post: any) => !hiddenPostIds.has(post.id))
    .map((post: any) => {
      const author = Array.isArray(post.profiles)
        ? post.profiles[0] ?? null
        : post.profiles ?? null

      const postCategories = Array.isArray(post.post_categories)
        ? post.post_categories.map(normalizeNestedCategory)
        : []

      const likes = Array.isArray(post.likes) ? post.likes : []
      const saves = Array.isArray(post.saves) ? post.saves : []
      const comments = Array.isArray(post.comments) ? post.comments : []

      const likeCount = likes.length
      const saveCount = saveCounts.get(post.id) ?? 0
      const commentCount = comments.length
      const fromFollowing = followedCreatorIds.has(post.author_id)
      const recencyBoost = getRecencyBoost(post.created_at)
      const categoryBoost = getCategoryBoost(preferenceMap, postCategories)
      const matchingCategories = getMatchingCategories(preferenceMap, postCategories)

      const followingBoost = fromFollowing ? 22 : 0
      const trendingBoost = likeCount * 2 + saveCount * 4 + commentCount * 3
      const diversityBoost = fromFollowing ? 0 : 5

      const feedScore =
        followingBoost +
        categoryBoost +
        trendingBoost +
        recencyBoost +
        diversityBoost

      const reasonLabels = buildReasonLabels({
        fromFollowing,
        matchingCategories,
        likeCount,
        saveCount,
        commentCount,
        recencyBoost,
      })

      return {
        id: post.id,
        author_id: post.author_id,
        author,
        caption: post.caption,
        media_type: post.media_type,
        media_path: post.media_path,
        thumbnail_path: post.thumbnail_path,
        created_at: post.created_at,
        like_count: likeCount,
        liked_by_me: likes.some((like: any) => like.profile_id === viewerProfileId),
        save_count: saveCount,
        saved_by_me: saves.some((save: any) => save.profile_id === viewerProfileId),
        comment_count: commentCount,
        comments,
        post_categories: postCategories,
        feed_score: feedScore,
        reason_labels: reasonLabels,
        source_bucket: fromFollowing
          ? 'following'
          : matchingCategories.length > 0
            ? 'interest'
            : 'trending',
      }
    })
    .sort((a: any, b: any) => {
      if (b.feed_score !== a.feed_score) {
        return b.feed_score - a.feed_score
      }

      if (b.save_count !== a.save_count) {
        return b.save_count - a.save_count
      }

      if (b.comment_count !== a.comment_count) {
        return b.comment_count - a.comment_count
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 24)

  const topInterestCategories = [...preferenceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([slug]) => {
      for (const post of normalizedPosts) {
        for (const item of post.post_categories ?? []) {
          const category = item?.categories
          if (category?.slug === slug) {
            return {
              id: category.id,
              name: category.name,
              slug: category.slug,
            }
          }
        }
      }

      return null
    })
    .filter(Boolean) as FeedCategory[]

  const summary: FeedSummary = {
    followedCreatorCount: followedCreatorIds.size,
    hiddenPostCount: hiddenPostIds.size,
    topInterestCategories,
    recommendationMix: {
      fromFollowing: normalizedPosts.filter(
        (post: any) => post.source_bucket === 'following'
      ).length,
      byInterest: normalizedPosts.filter(
        (post: any) => post.source_bucket === 'interest'
      ).length,
      trending: normalizedPosts.filter(
        (post: any) => post.source_bucket === 'trending'
      ).length,
    },
  }

  return {
    posts: normalizedPosts,
    summary,
  }
}