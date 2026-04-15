import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CopyProfileLinkButton } from '@/components/profile/copy-profile-link-button'
import { FollowButton } from '@/components/profile/follow-button'
import { NetworkProfileList } from '@/components/profile/network-profile-list'
import { NetworkSearchForm } from '@/components/profile/network-search-form'
import { PageShell } from '@/components/ui/page-shell'
import { SurfaceHero } from '@/components/ui/surface-hero'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { getProfileNetworkPageData } from '@/lib/db/queries/network'
import { getProfilePageData } from '@/lib/db/queries/profile'
import { getMediaUrl } from '@/lib/media/get-media-url'

type FollowingPageProps = {
  params: Promise<{
    profileId: string
  }>
  searchParams?: Promise<{
    q?: string
  }>
}

export default async function FollowingPage({
  params,
  searchParams,
}: FollowingPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const viewedProfileId = String(resolvedParams?.profileId || '').trim()
  const query = String(resolvedSearchParams?.q || '').trim()
  const { profileId: viewerProfileId } = await getDevSession()

  if (!viewedProfileId) {
    redirect('/profile')
  }

  const [{ profile, stats }, { profiles, summary }] = await Promise.all([
    getProfilePageData(viewerProfileId, viewedProfileId),
    getProfileNetworkPageData(viewerProfileId, viewedProfileId, 'following', query),
  ])

  const resolvedAvatarUrl = await getMediaUrl(profile.avatar_url ?? null)
  const returnTo = query
    ? `/profile/${viewedProfileId}/following?q=${encodeURIComponent(query)}`
    : `/profile/${viewedProfileId}/following`

  return (
    <PageShell maxWidth="6xl">
      <SurfaceHero
        eyebrow="Network"
        title={`Following of @${profile.username}`}
        description="See who this creator follows, search their network graph, and move through public creator surfaces without dropping the current context."
        actions={[
          {
            href: profile.is_own_profile ? '/profile' : `/profile/${viewedProfileId}`,
            label: 'Back to profile',
            variant: 'secondary',
          },
          { href: '/explore', label: 'Explore creators', variant: 'secondary' },
        ]}
        stats={[
          {
            label: 'Following',
            value: stats.following_count,
            helper: 'creators currently in this follow graph',
          },
          {
            label: 'Results',
            value: summary.total,
            helper: 'profiles in the current search view',
          },
          {
            label: 'Mutuals',
            value: summary.mutual_count,
            helper: 'creator overlap with your own network',
          },
        ]}
      />

      <section className="overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
        <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={profile.display_name}
                  className="h-16 w-16 rounded-full border border-zinc-800 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-900 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  No avatar
                </div>
              )}

              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold tracking-tight text-white">
                  {profile.display_name}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">@{profile.username}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  The creators currently connected to this public follow graph.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!profile.is_own_profile ? (
                <FollowButton
                  followerId={viewerProfileId}
                  followingId={profile.id}
                  followedByMe={profile.followed_by_me}
                  returnTo={returnTo}
                />
              ) : null}

              <CopyProfileLinkButton profileId={profile.id} />

              <Link
                href={profile.is_own_profile ? '/profile/followers' : `/profile/${viewedProfileId}/followers`}
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open followers
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Total following
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {stats.following_count}
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Search results
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {summary.total}
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Mutuals
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {summary.mutual_count}
            </p>
          </div>

          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Creators
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {summary.creator_count}
            </p>
          </div>
        </div>
      </section>

      <NetworkSearchForm
        placeholder="Search followed creators by name, username, or bio"
        defaultValue={query}
      />

      <NetworkProfileList
        profiles={profiles}
        viewerProfileId={viewerProfileId}
        returnTo={returnTo}
        emptyTitle={query ? 'No following match your search' : 'This creator is not following anyone yet'}
        emptyBody={
          query
            ? 'Try a different name, username, or bio keyword.'
            : 'Creators followed by this profile will appear here.'
        }
      />
    </PageShell>
  )
}