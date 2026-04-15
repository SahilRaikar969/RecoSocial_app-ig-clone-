import Link from 'next/link'
import { FollowButton } from '@/components/profile/follow-button'
import { SmartImage } from '@/components/ui/smart-image'
import { getMediaUrl } from '@/lib/media/get-media-url'

type NetworkProfile = {
  id: string
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  is_viewer: boolean
  followed_by_me: boolean
  follows_you: boolean
  is_mutual?: boolean
  follower_count?: number
  post_count?: number
}

type NetworkProfileListProps = {
  profiles: NetworkProfile[]
  viewerProfileId: string
  returnTo: string
  emptyTitle: string
  emptyBody: string
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  }

  return String(value)
}

export async function NetworkProfileList({
  profiles,
  viewerProfileId,
  returnTo,
  emptyTitle,
  emptyBody,
}: NetworkProfileListProps) {
  const viewerCount = profiles.filter((profile) => profile.is_viewer).length
  const mutualCount = profiles.filter(
    (profile) => profile.is_mutual && !profile.is_viewer
  ).length
  const followingCount = profiles.filter(
    (profile) => profile.followed_by_me && !profile.is_viewer
  ).length
  const followsYouCount = profiles.filter(
    (profile) => profile.follows_you && !profile.is_viewer
  ).length

  if (!profiles.length) {
    return (
      <div className="rounded-[32px] border border-zinc-800/90 bg-black p-6">
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-800 bg-zinc-950/80 px-6 text-center">
          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Network
          </div>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            {emptyTitle}
          </h2>

          <p className="mt-3 max-w-md text-sm leading-7 text-zinc-400">
            {emptyBody}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Results
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {profiles.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Mutuals
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {mutualCount}
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Following
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {followingCount}
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Follows you
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {followsYouCount + viewerCount}
          </p>
        </div>
      </section>

      <div className="space-y-4">
        {await Promise.all(
          profiles.map(async (networkProfile) => {
            const avatarUrl = await getMediaUrl(networkProfile.avatar_url ?? null)
            const profileHref = networkProfile.is_viewer
              ? '/profile'
              : `/profile/${networkProfile.id}`

            return (
              <article
                key={networkProfile.id}
                className="overflow-hidden rounded-[30px] border border-zinc-800/90 bg-black"
              >
                <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={profileHref}
                      className="flex min-w-0 items-start gap-4 rounded-2xl transition hover:opacity-90"
                    >
                      <SmartImage
                        src={avatarUrl}
                        alt={networkProfile.display_name}
                        className="h-14 w-14 rounded-full border border-zinc-800 object-cover sm:h-16 sm:w-16"
                        fallbackClassName="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:h-16 sm:w-16"
                        fallbackText="User"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-white sm:text-lg">
                            {networkProfile.display_name}
                          </h3>

                          {networkProfile.is_viewer ? (
                            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                              You
                            </span>
                          ) : null}

                          {networkProfile.is_mutual ? (
                            <span className="rounded-full border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                              Mutual
                            </span>
                          ) : null}

                          {!networkProfile.is_mutual && networkProfile.followed_by_me ? (
                            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                              Following
                            </span>
                          ) : null}

                          {!networkProfile.is_mutual &&
                          !networkProfile.followed_by_me &&
                          networkProfile.follows_you ? (
                            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                              Follows you
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 text-sm text-zinc-500">
                          @{networkProfile.username}
                        </p>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                          {networkProfile.bio || 'No bio added yet.'}
                        </p>
                      </div>
                    </Link>

                    {!networkProfile.is_viewer ? (
                      <div className="hidden sm:block">
                        <FollowButton
                          followerId={viewerProfileId}
                          followingId={networkProfile.id}
                          followedByMe={networkProfile.followed_by_me}
                          returnTo={returnTo}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={profileHref}
                      className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      View profile
                    </Link>

                    {!networkProfile.is_viewer ? (
                      <div className="sm:hidden">
                        <FollowButton
                          followerId={viewerProfileId}
                          followingId={networkProfile.id}
                          followedByMe={networkProfile.followed_by_me}
                          returnTo={returnTo}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        Followers
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white sm:text-base">
                        {formatCompactNumber(networkProfile.follower_count ?? 0)}
                      </p>
                    </div>

                    <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        Posts
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white sm:text-base">
                        {formatCompactNumber(networkProfile.post_count ?? 0)}
                      </p>
                    </div>

                    <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/80 px-3 py-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        Status
                      </p>
                      <p className="mt-2 text-xs font-medium text-zinc-300 sm:text-sm">
                        {networkProfile.is_viewer
                          ? 'Your profile'
                          : networkProfile.is_mutual
                            ? 'Mutual'
                            : networkProfile.followed_by_me
                              ? 'Following'
                              : networkProfile.follows_you
                                ? 'Follows you'
                                : 'Discover'}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}