import type { PostCardPost } from '@/components/feed/post-card'
import { buildCategoryHighlights, resolvePostsWithMedia } from '@/lib/profile/post-presentation'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfilePostGrid } from '@/components/profile/profile-post-grid'
import { HiddenPostGrid } from '@/components/profile/hidden-post-grid'
import { ProfileSurfaceEmpty } from '@/components/profile/profile-surface-empty'
import { ProfileSurfaceTabs } from '@/components/profile/profile-surface-tabs'
import { requireSession } from '@/lib/auth/session'
import { getHiddenPosts } from '@/lib/db/queries/hidden'
import { getLikedPosts } from '@/lib/db/queries/liked'
import { getProfilePageData } from '@/lib/db/queries/profile'
import { getProfileCollectionCount, type ProfileCollection } from '@/lib/db/queries/profile-collection-counts'
import { getReportedPosts } from '@/lib/db/queries/reported'
import { getSavedPosts } from '@/lib/db/queries/saved'
import { getMediaUrl } from '@/lib/media/get-media-url'

type SelfProfileTab = 'posts' | 'saved' | 'liked' | 'hidden' | 'reported'

type SelfProfilePageProps = {
  searchParams?: Promise<{
    tab?: string
    saved?: string
    liked?: string
    hidden?: string
    unhidden?: string
    reported?: string
    deleted?: string
    profile_updated?: string
    error?: string
  }>
}

function normalizeTab(value?: string): SelfProfileTab {
  if (value === 'saved') return 'saved'
  if (value === 'liked') return 'liked'
  if (value === 'hidden') return 'hidden'
  if (value === 'reported') return 'reported'
  return 'posts'
}

function getErrorMessage(value?: string) {
  const error = String(value || '').trim()

  if (!error) return ''

  switch (error) {
    case 'missing_hide_ids':
      return 'Missing hide ids.'
    case 'missing_unhide_ids':
      return 'Missing unhide ids.'
    case 'missing_report_ids':
      return 'Missing report ids.'
    case 'post_not_found':
      return 'Post not found.'
    case 'cannot_hide_own_post':
      return 'You cannot hide your own post.'
    case 'cannot_report_own_post':
      return 'You cannot report your own post.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

function buildReturnTo(tab: SelfProfileTab) {
  if (tab === 'posts') return '/profile'
  return `/profile?tab=${tab}`
}


export const metadata = { title: "Your profile" }

export default async function SelfProfilePage({
  searchParams,
}: SelfProfilePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeTab = normalizeTab(resolvedSearchParams?.tab)

  const { profileId } = await requireSession()

  const collectionLoaders = {
    saved: getSavedPosts,
    liked: getLikedPosts,
    hidden: getHiddenPosts,
    reported: getReportedPosts,
  }
  const collectionKeys = Object.keys(collectionLoaders) as ProfileCollection[]
  const [{ profile, stats, posts }, activeCollection, inactiveCounts] = await Promise.all([
    getProfilePageData(profileId, profileId),
    activeTab === 'posts' ? Promise.resolve([]) : collectionLoaders[activeTab](profileId),
    Promise.all(collectionKeys.filter(key => key !== activeTab).map(async key =>
      [key, await getProfileCollectionCount(profileId, key)] as const
    )).then(entries => new Map(entries)),
  ])
  const savedPosts = activeTab === 'saved' ? activeCollection : []
  const likedPosts = activeTab === 'liked' ? activeCollection : []
  const hiddenPosts = activeTab === 'hidden' ? activeCollection : []
  const reportedPosts = activeTab === 'reported' ? activeCollection : []

  const [
    avatarUrl,
    resolvedOwnPosts,
    resolvedSavedPosts,
    resolvedLikedPosts,
    resolvedHiddenPosts,
    resolvedReportedPosts,
  ] = await Promise.all([
    getMediaUrl(profile.avatar_url ?? null),
    resolvePostsWithMedia(activeTab === 'posts' ? posts : []),
    resolvePostsWithMedia(savedPosts),
    resolvePostsWithMedia(likedPosts),
    resolvePostsWithMedia(hiddenPosts),
    resolvePostsWithMedia(reportedPosts),
  ])

  const tabData: Record<
    SelfProfileTab,
    {
      emptyTitle: string
      emptyBody: string
      count: number
      posts: PostCardPost[]
      returnTo: string
      useHiddenGrid?: boolean
    }
  > = {
    posts: {
      emptyTitle: 'No posts yet',
      emptyBody: 'Create your first post to build your profile.',
      count: posts.length,
      posts: resolvedOwnPosts,
      returnTo: '/profile',
    },
    saved: {
      emptyTitle: 'No saved posts yet',
      emptyBody: 'Posts you save will appear here.',
      count: activeTab === 'saved' ? resolvedSavedPosts.length : inactiveCounts.get('saved') ?? 0,
      posts: resolvedSavedPosts,
      returnTo: '/profile?tab=saved',
    },
    liked: {
      emptyTitle: 'No liked posts yet',
      emptyBody: 'Posts you like will appear here.',
      count: activeTab === 'liked' ? resolvedLikedPosts.length : inactiveCounts.get('liked') ?? 0,
      posts: resolvedLikedPosts,
      returnTo: '/profile?tab=liked',
    },
    hidden: {
      emptyTitle: 'No hidden posts',
      emptyBody: 'Posts you hide will appear here until you restore them.',
      count: activeTab === 'hidden' ? resolvedHiddenPosts.length : inactiveCounts.get('hidden') ?? 0,
      posts: resolvedHiddenPosts,
      returnTo: '/profile?tab=hidden',
      useHiddenGrid: true,
    },
    reported: {
      emptyTitle: 'No reported posts',
      emptyBody: 'Reported posts will appear here.',
      count: activeTab === 'reported' ? resolvedReportedPosts.length : inactiveCounts.get('reported') ?? 0,
      posts: resolvedReportedPosts,
      returnTo: '/profile?tab=reported',
    },
  }

  const currentMeta = tabData[activeTab]
  const categoryHighlights = buildCategoryHighlights(posts)

  const tabs = [
    {
      key: 'posts',
      label: 'Posts',
      href: '/profile',
      count: tabData.posts.count,
      active: activeTab === 'posts',
    },
    {
      key: 'saved',
      label: 'Saved',
      href: '/profile?tab=saved',
      count: tabData.saved.count,
      active: activeTab === 'saved',
    },
    {
      key: 'liked',
      label: 'Liked',
      href: '/profile?tab=liked',
      count: tabData.liked.count,
      active: activeTab === 'liked',
    },
    {
      key: 'hidden',
      label: 'Hidden',
      href: '/profile?tab=hidden',
      count: tabData.hidden.count,
      active: activeTab === 'hidden',
    },
    {
      key: 'reported',
      label: 'Reported',
      href: '/profile?tab=reported',
      count: tabData.reported.count,
      active: activeTab === 'reported',
    },
  ] as const

  const feedback =
    resolvedSearchParams?.profile_updated === '1'
      ? 'Profile updated successfully.'
      : resolvedSearchParams?.saved === 'added'
        ? 'Post saved.'
        : resolvedSearchParams?.saved === 'removed'
          ? 'Post removed from saved.'
          : resolvedSearchParams?.liked === 'added'
            ? 'Post liked.'
            : resolvedSearchParams?.liked === 'removed'
              ? 'Like removed.'
              : resolvedSearchParams?.hidden === '1'
                ? 'Post hidden from your feed and explore.'
                : resolvedSearchParams?.unhidden === '1'
                  ? 'Post restored to your feed and Explore.'
                  : resolvedSearchParams?.reported === '1'
                    ? 'Post reported.'
                    : resolvedSearchParams?.deleted === '1'
                      ? 'Post deleted.'
                      : ''

  const errorMessage = getErrorMessage(resolvedSearchParams?.error)

  return (
    <div className="mx-auto w-full max-w-4xl py-2">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <ProfileHeader
        profile={profile}
        viewerProfileId={profileId}
        counts={{
          postCount: stats.post_count,
          followerCount: stats.follower_count,
          followingCount: stats.following_count,
        }}
        avatarUrl={avatarUrl}
        isOwnProfile
        returnTo={buildReturnTo(activeTab)}
        categoryHighlights={categoryHighlights}
      />

      <ProfileSurfaceTabs tabs={tabs} />

      <div className="mt-1">
        {currentMeta.posts.length ? (
          currentMeta.useHiddenGrid ? (
            <HiddenPostGrid
              posts={currentMeta.posts}
              devProfileId={profileId}
              returnTo={currentMeta.returnTo}
            />
          ) : (
            <ProfilePostGrid
              posts={currentMeta.posts}
              emptyTitle={currentMeta.emptyTitle}
              emptyBody={currentMeta.emptyBody}
            />
          )
        ) : (
          <ProfileSurfaceEmpty
            eyebrow="Profile"
            title={currentMeta.emptyTitle}
            body={currentMeta.emptyBody}
          />
        )}
      </div>
    </div>
  )
}
