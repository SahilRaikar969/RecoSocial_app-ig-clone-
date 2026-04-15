import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { ReelViewer } from '@/components/reels/reel-viewer'

type ReelPageProps = {
  params: Promise<{
    postId: string
  }>
  searchParams?: Promise<{
    from?: string
    profileId?: string
    category?: string
    q?: string
  }>
}

function buildBackHref({
  postId,
  from,
  profileId,
  category,
  q,
}: {
  postId: string
  from?: string
  profileId?: string
  category?: string
  q?: string
}) {
  const source = String(from || '').trim()

  if (source === 'post') {
    return `/post/${encodeURIComponent(postId)}`
  }

  if (source === 'profile' && profileId) {
    return `/profile/${encodeURIComponent(profileId)}`
  }

  if (source === 'saved') return '/saved'
  if (source === 'activity') return '/activity'

  if (source === 'explore') {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    const search = params.toString()
    return search ? `/explore?${search}` : '/explore'
  }

  return '/feed'
}

function buildViewerQueryString({
  from,
  profileId,
  category,
  q,
}: {
  from?: string
  profileId?: string
  category?: string
  q?: string
}) {
  const params = new URLSearchParams()

  if (from) params.set('from', from)
  if (profileId) params.set('profileId', profileId)
  if (category) params.set('category', category)
  if (q) params.set('q', q)

  return params.toString()
}

export default async function ReelPage({
  params,
  searchParams,
}: ReelPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const postId = String(resolvedParams?.postId || '').trim()
  const { profileId } = await getDevSession()
  const supabase = await createClient()

  const { data: currentPost } = await supabase
    .from('posts')
    .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
    .eq('id', postId)
    .eq('media_type', 'video')
    .maybeSingle()

  if (!currentPost) {
    notFound()
  }

  let relatedQuery = supabase
    .from('posts')
    .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
    .eq('media_type', 'video')
    .neq('id', postId)
    .order('created_at', { ascending: false })
    .limit(12)

  const source = String(resolvedSearchParams?.from || 'feed').trim()
  const sourceProfileId = String(resolvedSearchParams?.profileId || '').trim()
  const activeCategory = String(resolvedSearchParams?.category || '').trim()

  if (source === 'profile') {
    const targetAuthorId = sourceProfileId || currentPost.author_id
    if (targetAuthorId) {
      relatedQuery = relatedQuery.eq('author_id', targetAuthorId)
    }
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
      relatedQuery = supabase
        .from('posts')
        .select('id, author_id, caption, media_type, media_path, thumbnail_path, created_at')
        .eq('media_type', 'video')
        .in('id', categoryPostIds)
        .order('created_at', { ascending: false })
        .limit(12)
    }
  }

  const { data: relatedPosts } = await relatedQuery

  const reelBase = [currentPost, ...(relatedPosts || [])]
  const uniqueReels = Array.from(
    new Map(reelBase.map((item) => [item.id, item])).values()
  )

  const authorIds = Array.from(new Set(uniqueReels.map((item) => item.author_id)))
  const reelIds = uniqueReels.map((item) => item.id)

  const [profilesRes, likesRes, savesRes, commentsRes, viewerLikesRes, viewerSavesRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds),
      supabase.from('likes').select('post_id').in('post_id', reelIds),
      supabase.from('saves').select('post_id').in('post_id', reelIds),
      supabase.from('comments').select('post_id').in('post_id', reelIds),
      supabase
        .from('likes')
        .select('post_id')
        .eq('profile_id', profileId)
        .in('post_id', reelIds),
      supabase
        .from('saves')
        .select('post_id')
        .eq('profile_id', profileId)
        .in('post_id', reelIds),
    ])

  const profileMap = new Map(
    (profilesRes.data || []).map((profile: any) => [profile.id, profile])
  )

  const countMap = (rows: any[] | null | undefined) => {
    const map = new Map<string, number>()
    for (const row of rows || []) {
      map.set(row.post_id, (map.get(row.post_id) || 0) + 1)
    }
    return map
  }

  const likeCountMap = countMap(likesRes.data)
  const saveCountMap = countMap(savesRes.data)
  const commentCountMap = countMap(commentsRes.data)

  const viewerLikedSet = new Set((viewerLikesRes.data || []).map((row: any) => row.post_id))
  const viewerSavedSet = new Set((viewerSavesRes.data || []).map((row: any) => row.post_id))

  const reels = await Promise.all(
    uniqueReels.map(async (item) => ({
      id: item.id,
      author_id: item.author_id,
      caption: item.caption ?? null,
      created_at: item.created_at,
      media_url: await getMediaUrl(item.media_path),
      thumbnail_url: await getMediaUrl(item.thumbnail_path ?? null),
      like_count: likeCountMap.get(item.id) || 0,
      save_count: saveCountMap.get(item.id) || 0,
      comment_count: commentCountMap.get(item.id) || 0,
      liked_by_me: viewerLikedSet.has(item.id),
      saved_by_me: viewerSavedSet.has(item.id),
      author: profileMap.get(item.author_id) || null,
    }))
  )

  return (
    <ReelViewer
      reels={reels}
      initialPostId={postId}
      viewerProfileId={profileId}
      backHref={buildBackHref({
        postId,
        from: resolvedSearchParams?.from,
        profileId: resolvedSearchParams?.profileId,
        category: resolvedSearchParams?.category,
        q: resolvedSearchParams?.q,
      })}
      viewerQueryString={buildViewerQueryString({
        from: resolvedSearchParams?.from,
        profileId: resolvedSearchParams?.profileId,
        category: resolvedSearchParams?.category,
        q: resolvedSearchParams?.q,
      })}
    />
  )
}