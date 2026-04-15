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

export async function getReportedPosts(devProfileId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('post_reports')
    .select(`
      post_id,
      reason,
      details,
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
    .eq('reporter_id', devProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const reportedRows = (data ?? []).filter((row: any) => row.posts)

  if (!reportedRows.length) return []

  const reportedPosts = reportedRows.map((row: any) => ({
    ...row.posts,
    __report_reason: row.reason,
    __report_details: row.details,
  }))

  const profileIds = reportedPosts.flatMap((post: any) => [
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

  return reportedPosts.map((post: any) => {
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

    const reportReason =
      typeof post.__report_reason === 'string' && post.__report_reason.trim()
        ? post.__report_reason.trim()
        : 'other'

    const reportDetails =
      typeof post.__report_details === 'string'
        ? post.__report_details.trim()
        : ''

    return {
      ...post,
      author: profileMap.get(post.author_id) ?? null,
      like_count: likes.length,
      liked_by_me: likes.some((like: any) => like.profile_id === devProfileId),
      save_count: saves.length,
      saved_by_me: saves.some((save: any) => save.profile_id === devProfileId),
      comment_count: comments.length,
      comments: comments.map((comment: any) => ({
        ...comment,
        author: profileMap.get(comment.author_id) ?? null,
      })),
      post_categories: categories,
      report_reason: reportReason,
      report_details: reportDetails || null,
      reason_labels: [`Reported: ${reportReason}`],
    }
  })
}