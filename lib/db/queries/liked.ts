import { createClient } from '@/lib/supabase/server'
import { getVisiblePostSaveCounts } from '@/lib/db/queries/save-counts'

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

export async function getLikedPosts(devProfileId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('likes')
    .select(`
      post_id,
      posts (
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
      )
    `)
    .eq('profile_id', devProfileId)

  if (error) throw new Error(error.message)

  const likedPosts = (data ?? []).map((row: any) => row.posts).filter(Boolean)

  if (!likedPosts.length) return []

  const saveCounts = await getVisiblePostSaveCounts(
    supabase,
    likedPosts.map((post: { id: string }) => post.id)
  )

  const profileIds = likedPosts.flatMap((post: any) => [
    post.author_id,
    ...(Array.isArray(post.comments)
      ? post.comments.map((comment: any) => comment.author_id)
      : []),
  ])

  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))]

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .in('id', uniqueProfileIds)

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map(
    (profilesData ?? []).map((profile: any) => [profile.id, profile])
  )

  return likedPosts.map((post: any) => {
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
      author: profileMap.get(post.author_id) ?? null,
      like_count: likes.length,
      liked_by_me: likes.some((like: any) => like.profile_id === devProfileId),
      save_count: saveCounts.get(post.id) ?? 0,
      saved_by_me: saves.some((save: any) => save.profile_id === devProfileId),
      comment_count: comments.length,
      comments: comments.map((comment: any) => ({
        ...comment,
        author: profileMap.get(comment.author_id) ?? null,
      })),
      post_categories: categories,
      reason_labels: ['Liked by you'],
    }
  })
}