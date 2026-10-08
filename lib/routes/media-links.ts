type ReelSource = 'feed' | 'explore' | 'profile' | 'saved' | 'activity' | 'post'

export type MediaOpenContext = {
  source?: ReelSource
  profileId?: string | null
  category?: string | null
  query?: string | null
  feedView?: string | null
  feedPage?: string | null
}

type BuildPostOpenHrefInput = MediaOpenContext & {
  postId: string
  mediaType?: string | null
}

export function buildPostOpenHref({
  postId,
  mediaType,
  source = 'feed',
  profileId,
  category,
  query,
  feedView,
  feedPage,
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
    if (source === 'feed' && feedView === 'following') params.set('view', 'following')
    if (source === 'feed' && feedPage) params.set('page', feedPage)

    const search = params.toString()
    return search ? `/reel/${cleanPostId}?${search}` : `/reel/${cleanPostId}`
  }

  return `/post/${cleanPostId}`
}
/** Reuse the actual listing scope for media navigation instead of hardcoding feed/profile. */
export function mediaContextFromReturnTo(returnTo: string): MediaOpenContext {
  const url = new URL(returnTo, 'http://local.invalid')
  if (url.origin !== 'http://local.invalid') return { source: 'feed' }
  if (url.pathname === '/explore') return { source: 'explore', category: url.searchParams.get('category'), query: url.searchParams.get('q') }
  if (url.pathname === '/saved') return { source: 'saved' }
  return { source: 'feed', feedView: url.searchParams.get('view'), feedPage: url.searchParams.get('page') }
}
