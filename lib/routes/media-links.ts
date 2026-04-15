type ReelSource = 'feed' | 'explore' | 'profile' | 'saved' | 'activity' | 'post'

type BuildPostOpenHrefInput = {
  postId: string
  mediaType?: string | null
  source?: ReelSource
  profileId?: string | null
  category?: string | null
  query?: string | null
}

export function buildPostOpenHref({
  postId,
  mediaType,
  source = 'feed',
  profileId,
  category,
  query,
}: BuildPostOpenHrefInput) {
  const cleanPostId = String(postId || '').trim()

  if (!cleanPostId) {
    return '/feed'
  }

  if (mediaType === 'video') {
    const params = new URLSearchParams()

    if (source) params.set('from', source)
    if (profileId) params.set('profileId', String(profileId).trim())
    if (category) params.set('category', String(category).trim())
    if (query) params.set('q', String(query).trim())

    const search = params.toString()
    return search ? `/reel/${cleanPostId}?${search}` : `/reel/${cleanPostId}`
  }

  return `/post/${cleanPostId}`
}