import { createClient } from '@/lib/supabase/server'
import { getHiddenPostIds } from '@/lib/db/queries/post-moderation'

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

function getCategorySlugs(
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
    .map((item) => item?.categories?.slug ?? null)
    .filter(Boolean) as string[]
}

function getSharedCategories(
  sourceCategories: Array<{
    category_id: string
    categories?: {
      id: string
      name: string
      slug: string
    } | null
  }>,
  candidateCategories: Array<{
    category_id: string
    categories?: {
      id: string
      name: string
      slug: string
    } | null
  }>
) {
  const sourceMap = new Map(
    sourceCategories
      .map((item) => item?.categories)
      .filter(Boolean)
      .map((category) => [category!.slug, category!])
  )

  return candidateCategories
    .map((item) => item?.categories)
    .filter(
      (
        category
      ): category is {
        id: string
        name: string
        slug: string
      } => !!category?.slug && sourceMap.has(category.slug)
    )
}

function buildRelatedReasonLabels(params: {
  sameAuthor: boolean
  sharedCategories: Array<{ id: string; name: string; slug: string }>
  saveCount: number
  commentCount: number
  recencyBoost: number
}) {
  const labels: string[] = []

  if (params.sameAuthor) {
    labels.push('More from this creator')
  }

  if (params.sharedCategories.length > 0) {
    for (const category of params.sharedCategories.slice(0, 2)) {
      labels.push(`Because you viewed ${category.name}`)
    }
  }

  if (params.saveCount >= 2) {
    labels.push('Popular with savers')
  }

  if (params.commentCount >= 2) {
    labels.push('Active conversation')
  }

  if (params.recencyBoost >= 3) {
    labels.push('Fresh post')
  }

  return [...new Set(labels)].slice(0, 3)
}

function scoreRelatedPost(params: {
  sameAuthor: boolean
  sharedCategoryCount: number
  likeCount: number
  saveCount: number
  commentCount: number
  recencyBoost: number
}) {
  const sameAuthorBoost = params.sameAuthor ? 14 : 0
  const categoryBoost = params.sharedCategoryCount * 7
  const engagementBoost =
    params.likeCount * 2 + params.saveCount * 4 + params.commentCount * 3

  return sameAuthorBoost + categoryBoost + engagementBoost + params.recencyBoost
}

async function getProfileMap(supabase: any, profileIds: string[]) {
  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))]
  let profileMap = new Map<string, any>()

  if (uniqueProfileIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .in('id', uniqueProfileIds)

    if (profilesError) {
      throw new Error(profilesError.message)
    }

    profileMap = new Map(
      (profilesData ?? []).map((profile: any) => [profile.id, profile])
    )
  }

  return profileMap
}

function normalizePostShape(post: any, viewerProfileId: string) {
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
    liked_by_me: likes.some((like: any) => like.profile_id === viewerProfileId),
    save_count: saves.length,
    saved_by_me: saves.some((save: any) => save.profile_id === viewerProfileId),
    comment_count: comments.length,
    comments,
    post_categories: categories,
  }
}

export async function getPostPageData(
  viewerProfileId: string,
  postId: string
) {
  const safePostId = String(postId || '').trim()

  if (!safePostId || safePostId === 'undefined' || safePostId === 'null') {
    return null
  }

  const supabase = await createClient()

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
    .eq('id', safePostId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const normalizedPost = normalizePostShape(data, viewerProfileId)

  const hiddenPostIds = await getHiddenPostIds(viewerProfileId)

  const baseProfileIds = [
    normalizedPost.author_id,
    ...normalizedPost.comments.map((comment: any) => comment.author_id),
  ].filter(Boolean)

  const profileMap = await getProfileMap(supabase, baseProfileIds)

  const currentCategorySlugs = getCategorySlugs(normalizedPost.post_categories)

  const [
    { data: authorFollowerRows, error: authorFollowerError },
    { data: authorPostRows, error: authorPostError },
    { data: relatedRows, error: relatedError },
  ] = await Promise.all([
    supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', normalizedPost.author_id),

    supabase
      .from('posts')
      .select('id')
      .eq('author_id', normalizedPost.author_id),

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
      .neq('id', safePostId)
      .limit(48),
  ])

  if (authorFollowerError) {
    throw new Error(authorFollowerError.message)
  }

  if (authorPostError) {
    throw new Error(authorPostError.message)
  }

  if (relatedError) {
    throw new Error(relatedError.message)
  }

  const normalizedRelatedCandidates = (relatedRows ?? [])
    .map((post: any) => normalizePostShape(post, viewerProfileId))
    .filter((post: any) => !hiddenPostIds.has(post.id))
    .filter((post: any) => {
      const candidateCategorySlugs = getCategorySlugs(post.post_categories)
      const sharesCategory = candidateCategorySlugs.some((slug) =>
        currentCategorySlugs.includes(slug)
      )
      const sameAuthor = post.author_id === normalizedPost.author_id

      return sharesCategory || sameAuthor
    })

  const relatedProfileIds = normalizedRelatedCandidates.flatMap((post: any) => [
    post.author_id,
    ...(Array.isArray(post.comments)
      ? post.comments.map((comment: any) => comment.author_id)
      : []),
  ])

  const relatedProfileMap = await getProfileMap(supabase, relatedProfileIds)

  const relatedPosts = normalizedRelatedCandidates
    .map((post: any) => {
      const sharedCategories = getSharedCategories(
        normalizedPost.post_categories,
        post.post_categories
      )

      const sameAuthor = post.author_id === normalizedPost.author_id
      const recencyBoost = getRecencyBoost(post.created_at)
      const relatedScore = scoreRelatedPost({
        sameAuthor,
        sharedCategoryCount: sharedCategories.length,
        likeCount: post.like_count,
        saveCount: post.save_count,
        commentCount: post.comment_count,
        recencyBoost,
      })

      const reasonLabels = buildRelatedReasonLabels({
        sameAuthor,
        sharedCategories,
        saveCount: post.save_count,
        commentCount: post.comment_count,
        recencyBoost,
      })

      return {
        ...post,
        author: relatedProfileMap.get(post.author_id) ?? null,
        comments: (post.comments ?? []).map((comment: any) => ({
          ...comment,
          author: relatedProfileMap.get(comment.author_id) ?? null,
        })),
        reason_labels: reasonLabels,
        related_score: relatedScore,
      }
    })
    .sort((a: any, b: any) => {
      if (b.related_score !== a.related_score) {
        return b.related_score - a.related_score
      }

      if (b.save_count !== a.save_count) {
        return b.save_count - a.save_count
      }

      if (b.comment_count !== a.comment_count) {
        return b.comment_count - a.comment_count
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 6)

  return {
    ...normalizedPost,
    author: profileMap.get(normalizedPost.author_id) ?? null,
    is_owner: normalizedPost.author_id === viewerProfileId,
    comments: normalizedPost.comments.map((comment: any) => ({
      ...comment,
      author: profileMap.get(comment.author_id) ?? null,
    })),
    reason_labels: [],
    author_summary: {
      follower_count: (authorFollowerRows ?? []).length,
      post_count: (authorPostRows ?? []).length,
    },
    related_posts: relatedPosts,
  }
}