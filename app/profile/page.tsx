import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { InstagramProfileHeader } from '@/components/profile/instagram-profile-header'
import { ProfilePostGrid } from '@/components/profile/profile-post-grid'
import { HiddenPostGrid } from '@/components/profile/hidden-post-grid'
import { ProfileSurfaceEmpty } from '@/components/profile/profile-surface-empty'
import { ProfileSurfaceTabs } from '@/components/profile/profile-surface-tabs'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getHiddenPosts } from '@/lib/db/queries/hidden'
import { getLikedPosts } from '@/lib/db/queries/liked'
import { getProfilePageData } from '@/lib/db/queries/profile'
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
      return decodeURIComponent(error)
  }
}

function buildReturnTo(tab: SelfProfileTab) {
  if (tab === 'posts') return '/profile'
  return `/profile?tab=${tab}`
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

export default async function SelfProfilePage({
  searchParams,
}: SelfProfilePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeTab = normalizeTab(resolvedSearchParams?.tab)

  const { profileId } = await getDevSession()

  const [
    { profile, stats, posts },
    savedPosts,
    likedPosts,
    hiddenPosts,
    reportedPosts,
  ] = await Promise.all([
    getProfilePageData(profileId, profileId),
    getSavedPosts(profileId),
    getLikedPosts(profileId),
    getHiddenPosts(profileId),
    getReportedPosts(profileId),
  ])

  const [
    avatarUrl,
    resolvedOwnPosts,
    resolvedSavedPosts,
    resolvedLikedPosts,
    resolvedHiddenPosts,
    resolvedReportedPosts,
  ] = await Promise.all([
    getMediaUrl(profile.avatar_url ?? null),
    resolvePostsWithMedia(posts),
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
      posts: any[]
      returnTo: string
      useHiddenGrid?: boolean
    }
  > = {
    posts: {
      emptyTitle: 'No posts yet',
      emptyBody: 'Create your first post to build your profile.',
      count: resolvedOwnPosts.length,
      posts: resolvedOwnPosts,
      returnTo: '/profile',
    },
    saved: {
      emptyTitle: 'No saved posts yet',
      emptyBody: 'Posts you save will appear here.',
      count: resolvedSavedPosts.length,
      posts: resolvedSavedPosts,
      returnTo: '/profile?tab=saved',
    },
    liked: {
      emptyTitle: 'No liked posts yet',
      emptyBody: 'Posts you like will appear here.',
      count: resolvedLikedPosts.length,
      posts: resolvedLikedPosts,
      returnTo: '/profile?tab=liked',
    },
    hidden: {
      emptyTitle: 'No hidden posts',
      emptyBody: 'Posts you hide will appear here until you restore them.',
      count: resolvedHiddenPosts.length,
      posts: resolvedHiddenPosts,
      returnTo: '/profile?tab=hidden',
      useHiddenGrid: true,
    },
    reported: {
      emptyTitle: 'No reported posts',
      emptyBody: 'Reported posts will appear here.',
      count: resolvedReportedPosts.length,
      posts: resolvedReportedPosts,
      returnTo: '/profile?tab=reported',
    },
  }

  const currentMeta = tabData[activeTab]
  const categoryHighlights = buildCategoryHighlights(resolvedOwnPosts)

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
                  ? 'Post restored to your surfaces.'
                  : resolvedSearchParams?.reported === '1'
                    ? 'Post reported.'
                    : resolvedSearchParams?.deleted === '1'
                      ? 'Post deleted.'
                      : ''

  const errorMessage = getErrorMessage(resolvedSearchParams?.error)

  return (
    <main className="mx-auto w-full max-w-[935px] px-4 py-4 sm:px-6 sm:py-6">
      {feedback ? <FeedbackBanner>{feedback}</FeedbackBanner> : null}
      {errorMessage ? <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner> : null}

      <InstagramProfileHeader
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
    </main>
  )
}