import { normalizeNestedCategory } from '@/lib/db/normalize-relations'
import { createClient } from '@/lib/supabase/server'
import { getVisiblePostSaveCounts } from '@/lib/db/queries/save-counts'

export async function getSavedPosts(devProfileId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('saves')
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

  const savedPosts = (data ?? []).map((row) => row.posts).filter(Boolean)

  if (!savedPosts.length) return []

  const saveCounts = await getVisiblePostSaveCounts(
    supabase,
    savedPosts.map((post: { id: string }) => post.id)
  )

  const profileIds = savedPosts.flatMap((post) => [
    post.author_id,
    ...(Array.isArray(post.comments)
      ? post.comments.map((comment) => comment.author_id)
      : []),
  ])

  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))]

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .in('id', uniqueProfileIds)

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile])
  )

  return savedPosts.map((post) => {
    const likes = Array.isArray(post.likes) ? post.likes : []
    const saves = Array.isArray(post.saves) ? post.saves : []
    const comments = Array.isArray(post.comments) ? post.comments : []
    const categories = Array.isArray(post.post_categories)
      ? post.post_categories.map(normalizeNestedCategory)
      : []

    comments.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return {
      ...post,
      author: profileMap.get(post.author_id) ?? null,
      like_count: likes.length,
      liked_by_me: likes.some((like) => like.profile_id === devProfileId),
      save_count: saveCounts.get(post.id) ?? 0,
      saved_by_me: saves.some((save) => save.profile_id === devProfileId),
      comment_count: comments.length,
      comments: comments.map((comment) => ({
        ...comment,
        author: profileMap.get(comment.author_id) ?? null,
      })),
      post_categories: categories,
      reason_labels: ['Saved by you'],
    }
  })
}