import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfilePostGrid } from '@/components/profile/profile-post-grid'
import { ProfileSurfaceEmpty } from '@/components/profile/profile-surface-empty'
import { ProfileSurfaceTabs } from '@/components/profile/profile-surface-tabs'
import { getOptionalSession } from '@/lib/auth/get-dev-session'
import { getProfilePageData } from '@/lib/db/queries/profile'
import { getProfileCollectionCount } from '@/lib/db/queries/profile-collection-counts'
import { getPublicLikedPosts } from '@/lib/db/queries/public-liked'
import { getMediaUrl } from '@/lib/media/get-media-url'

type PublicProfileTab = 'posts' | 'liked'

type PublicProfilePageProps = {
  params: Promise<{
    profileId: string
  }>
  searchParams?: Promise<{
    tab?: string
    follow?: string
    error?: string
  }>
}

function normalizeTab(value?: string): PublicProfileTab {
  if (value === 'liked') return 'liked'
  return 'posts'
}

function buildReturnTo(profileId: string, tab: PublicProfileTab) {
  if (tab === 'posts') return `/profile/${profileId}`
  return `/profile/${profileId}?tab=${tab}`
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()

  if (!error) return ''

  switch (error) {
    case 'missing_follow_ids':
      return 'Missing follow ids.'
    case 'cannot_follow_self':
      return 'You cannot follow your own profile.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

function buildCategoryHighlights(posts: any[]) {
  const counts = new Map<string, { slug: string; name: string; count: number }>()

  for (const post of posts) {
    const categories = Array.isArray(post?.post_categories)
      ? post.post_categories
      : []

    for (const item of categories) {
      const category = Array.isArray(item?.categories)
        ? item.categories[0] ?? null
        : item?.categories ?? null

      if (!category?.slug || !category?.name) continue

      const existing = counts.get(category.slug)

      counts.set(category.slug, {
        slug: category.slug,
        name: category.name,
        count: (existing?.count ?? 0) + 1,
      })
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
}

async function resolvePostsWithMedia(posts: any[]) {
  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      resolved_media_url: await getMediaUrl(post.media_path),
      resolved_thumbnail_url: await getMediaUrl(post.thumbnail_path ?? null),
    }))
  )
}

async function createProfileViewNotification(viewerProfileId: string, viewedProfileId: string) {
  if (!viewerProfileId || !viewedProfileId || viewerProfileId === viewedProfileId) {
    return
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('record_profile_view', {
    target_profile_id: viewedProfileId,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const metadata = { title: "Profile" }

export default async function PublicProfilePage({
  params,
  searchParams,
}: PublicProfilePageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  let activeTab = normalizeTab(resolvedSearchParams?.tab)

  const viewedProfileId = String(resolvedParams?.profileId || '').trim()
  const session=await getOptionalSession()
  const viewerProfileId=session?.profileId ?? null

  if (!viewedProfileId || viewedProfileId === viewerProfileId) {
    redirect('/profile')
  }

  if(viewerProfileId) await createProfileViewNotification(viewerProfileId, viewedProfileId)
  else activeTab='posts'

  const [{ profile, stats, posts }, likedPosts, inactiveLikedCount] = await Promise.all([
    getProfilePageData(viewerProfileId, viewedProfileId),
    activeTab === 'liked' ? getPublicLikedPosts(viewerProfileId, viewedProfileId) : Promise.resolve([]),
    !viewerProfileId || activeTab === 'liked' ? Promise.resolve(0) : getProfileCollectionCount(viewedProfileId, 'liked'),
  ])

  const [avatarUrl, resolvedPosts, resolvedLikedPosts] = await Promise.all([
    getMediaUrl(profile.avatar_url ?? null),
    resolvePostsWithMedia(activeTab === 'posts' ? posts : []),
    resolvePostsWithMedia(likedPosts),
  ])


  const currentPosts = activeTab === 'liked' ? resolvedLikedPosts : resolvedPosts
  const categoryHighlights = buildCategoryHighlights(posts)

  const tabs = [
    {
      key: 'posts',
      label: 'Posts',
      href: `/profile/${viewedProfileId}`,
      count: posts.length,
      active: activeTab === 'posts',
    },
    {
      key: 'liked',
      label: 'Liked',
      href: `/profile/${viewedProfileId}?tab=liked`,
      count: activeTab === 'liked' ? resolvedLikedPosts.length : inactiveLikedCount,
      active: activeTab === 'liked',
    },
  ] as const

  const currentMeta =
    activeTab === 'liked'
      ? {
          emptyTitle: 'No liked posts visible yet',
          emptyBody: 'Liked posts will appear here.',
        }
      : {
          emptyTitle: 'No posts yet',
          emptyBody: 'Published posts will appear here.',
        }

  const feedback =
    resolvedSearchParams?.follow === 'added'
      ? `You are now following @${profile.username}.`
      : resolvedSearchParams?.follow === 'removed'
        ? `You unfollowed @${profile.username}.`
        : ''

  const errorMessage = getErrorMessage(resolvedSearchParams?.error)

  return (
    <div className="mx-auto w-full max-w-4xl py-2">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <ProfileHeader
        profile={profile}
        viewerProfileId={viewerProfileId}
        counts={{
          postCount: stats.post_count,
          followerCount: stats.follower_count,
          followingCount: stats.following_count,
        }}
        avatarUrl={avatarUrl}
        isOwnProfile={false}
        followedByMe={profile.followed_by_me}
        returnTo={buildReturnTo(viewedProfileId, activeTab)}
        categoryHighlights={categoryHighlights}
        canMessage={profile.can_message}
      />

      <>
        <ProfileSurfaceTabs tabs={viewerProfileId ? tabs : tabs.filter(tab=>tab.key==='posts')} />
        <div className="mt-1">
          {currentPosts.length ? (
            <ProfilePostGrid
              posts={currentPosts}
              emptyTitle={currentMeta.emptyTitle}
              emptyBody={currentMeta.emptyBody}
            />
          ) : (
            <ProfileSurfaceEmpty
              eyebrow="Profile"
              title={currentMeta.emptyTitle}
              body={currentMeta.emptyBody}
            />
          )}
        </div>
      </>
    </div>
  )
}
