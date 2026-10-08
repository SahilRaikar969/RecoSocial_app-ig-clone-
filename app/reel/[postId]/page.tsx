import { notFound } from 'next/navigation'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { ReelViewer } from '@/components/reels/reel-viewer'
import { getReelPageData } from '@/lib/db/queries/reels'

type ReelPageProps = {
  params: Promise<{
    postId: string
  }>
  searchParams?: Promise<{
    from?: string
    profileId?: string
    category?: string
    q?: string
    view?: string
    page?: string
  }>
}

function buildBackHref({
  postId,
  from,
  profileId,
  category,
  q,
  view,
  page,
}: {
  postId: string
  from?: string
  profileId?: string
  category?: string
  q?: string
  view?: string
  page?: string
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

  const feedParams = new URLSearchParams()
  if (view === 'following') feedParams.set('view', view)
  if (page) feedParams.set('page', page)
  return feedParams.size ? '/feed?' + feedParams.toString() : '/feed'
}

function buildViewerQueryString({
  from,
  profileId,
  category,
  q,
  view,
  page,
}: {
  from?: string
  profileId?: string
  category?: string
  q?: string
  view?: string
  page?: string
}) {
  const params = new URLSearchParams()

  if (from) params.set('from', from)
  if (profileId) params.set('profileId', profileId)
  if (category) params.set('category', category)
  if (q) params.set('q', q)

  if (view === 'following') params.set('view', view)
  if (page) params.set('page', page)
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
  const { reels } = await getReelPageData({
    viewerProfileId: profileId,
    postId,
    source: resolvedSearchParams?.from,
    sourceProfileId: resolvedSearchParams?.profileId,
    activeCategory: resolvedSearchParams?.category,
    searchQuery: resolvedSearchParams?.q,
    feedView: resolvedSearchParams?.view,
    feedPage: Number(resolvedSearchParams?.page ?? 1),
  })
  if (!reels.length) notFound()

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
        view: resolvedSearchParams?.view,
        page: resolvedSearchParams?.page,
      })}
      viewerQueryString={buildViewerQueryString({
        from: resolvedSearchParams?.from,
        profileId: resolvedSearchParams?.profileId,
        category: resolvedSearchParams?.category,
        q: resolvedSearchParams?.q,
        view: resolvedSearchParams?.view,
        page: resolvedSearchParams?.page,
      })}
    />
  )
}