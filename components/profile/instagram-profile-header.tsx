import Link from 'next/link'
import { Settings } from 'lucide-react'
import { CopyProfileLinkButton } from '@/components/profile/copy-profile-link-button'
import { FollowButton } from '@/components/profile/follow-button'
import { SmartImage } from '@/components/ui/smart-image'

type InstagramProfileHeaderProps = {
  profile: {
    id: string
    username: string
    display_name: string
    bio?: string | null
    avatar_url?: string | null
  }
  viewerProfileId: string
  counts: {
    postCount: number
    followerCount: number
    followingCount: number
  }
  avatarUrl?: string | null
  isOwnProfile: boolean
  followedByMe?: boolean
  returnTo?: string
  categoryHighlights?: Array<{
    slug: string
    name: string
    count: number
  }>
  canMessage?: boolean
}

function getFollowersHref(profileId: string, isOwnProfile: boolean) {
  return isOwnProfile ? '/profile/followers' : `/profile/${profileId}/followers`
}

function getFollowingHref(profileId: string, isOwnProfile: boolean) {
  return isOwnProfile ? '/profile/following' : `/profile/${profileId}/following`
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function InstagramProfileHeader({
  profile,
  viewerProfileId,
  counts,
  avatarUrl,
  isOwnProfile,
  followedByMe = false,
  returnTo,
  categoryHighlights = [],
  canMessage = false,
}: InstagramProfileHeaderProps) {
  const safeReturnTo =
    returnTo ||
    (isOwnProfile ? '/profile' : `/profile/${encodeURIComponent(profile.id)}`)

  return (
    <section className="relative overflow-hidden rounded-[30px] sm:rounded-[34px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] px-4 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.22)] sm:px-6 sm:py-7">
      <div className="pointer-events-none absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.08),transparent_24%)]" />

      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold leading-tight text-white sm:text-2xl sm:font-normal">
              {profile.username}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
              Creator surface
            </p>
          </div>

          {isOwnProfile ? (
            <Link
              href="/settings"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/85 text-zinc-200 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
              aria-label="Open settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[120px_minmax(0,1fr)] md:grid-cols-[150px_minmax(0,1fr)] md:gap-x-10">
          <div className="flex items-start justify-center md:justify-start">
            <SmartImage
              src={avatarUrl}
              alt={profile.display_name}
              className="h-[88px] w-[88px] rounded-full border border-zinc-700 bg-zinc-950 object-cover ring-4 ring-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] sm:h-[120px] sm:w-[120px] md:h-[150px] md:w-[150px]"
              fallbackClassName="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:h-[120px] sm:w-[120px] md:h-[150px] md:w-[150px]"
              fallbackText="No avatar"
            />
          </div>

          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center md:flex md:items-center md:gap-10 md:text-left">
              <Link
                href={isOwnProfile ? '/profile' : `/profile/${encodeURIComponent(profile.id)}`}
                className="rounded-[20px] border border-zinc-800 bg-zinc-950/70 px-2 py-3 transition hover:-translate-y-0.5 hover:border-zinc-700 md:border-0 md:bg-transparent md:px-0 md:py-0"
              >
                <span className="block text-lg font-semibold leading-none text-white">
                  {formatCount(counts.postCount)}
                </span>
                <span className="mt-1.5 block text-[11px] font-medium leading-4 text-zinc-300 sm:text-sm">
                  posts
                </span>
              </Link>

              <Link
                href={getFollowersHref(profile.id, isOwnProfile)}
                className="rounded-[20px] border border-zinc-800 bg-zinc-950/70 px-2 py-3 transition hover:-translate-y-0.5 hover:border-zinc-700 md:border-0 md:bg-transparent md:px-0 md:py-0"
              >
                <span className="block text-lg font-semibold leading-none text-white">
                  {formatCount(counts.followerCount)}
                </span>
                <span className="mt-1.5 block text-[11px] font-medium leading-4 text-zinc-300 sm:text-sm">
                  followers
                </span>
              </Link>

              <Link
                href={getFollowingHref(profile.id, isOwnProfile)}
                className="rounded-[20px] border border-zinc-800 bg-zinc-950/70 px-2 py-3 transition hover:-translate-y-0.5 hover:border-zinc-700 md:border-0 md:bg-transparent md:px-0 md:py-0"
              >
                <span className="block text-lg font-semibold leading-none text-white">
                  {formatCount(counts.followingCount)}
                </span>
                <span className="mt-1.5 block text-[11px] font-medium leading-4 text-zinc-300 sm:text-sm">
                  following
                </span>
              </Link>
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-zinc-800 bg-black/35 px-4 py-4">
                <p className="text-sm font-semibold text-white">
                  {profile.display_name}
                </p>

                {profile.bio?.trim() ? (
                  <p className="mt-2 max-w-2xl whitespace-pre-line break-words text-sm leading-7 text-zinc-300">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-7 text-zinc-500">
                    {isOwnProfile ? 'Add a bio to complete your profile.' : 'No bio yet.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isOwnProfile ? (
                  <>
                    <Link
                      href="/profile/edit"
                      className="rounded-xl border border-zinc-700 bg-zinc-950/85 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900"
                    >
                      Edit profile
                    </Link>

                    <Link
                      href="/create"
                      className="rounded-xl border border-white bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:opacity-90"
                    >
                      Create post
                    </Link>

                    <Link
                      href="/stories/create"
                      className="rounded-xl border border-zinc-700 bg-zinc-950/85 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900"
                    >
                      Add story
                    </Link>
                  </>
                ) : (
                  <>
                    <FollowButton
                      followerId={viewerProfileId}
                      followingId={profile.id}
                      followedByMe={followedByMe}
                      returnTo={safeReturnTo}
                    />

                    {canMessage ? (
                      <Link
                        href={`/messages?with=${encodeURIComponent(profile.id)}`}
                        className="rounded-xl border border-zinc-700 bg-zinc-950/85 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900"
                      >
                        Message
                      </Link>
                    ) : null}

                    <Link
                      href="/explore"
                      className="rounded-xl border border-zinc-700 bg-zinc-950/85 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900"
                    >
                      Explore
                    </Link>
                  </>
                )}

                <CopyProfileLinkButton
                  profileId={profile.id}
                  className="sm:min-w-0"
                />
              </div>
            </div>
          </div>
        </div>

        {categoryHighlights.length ? (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-4">
              {categoryHighlights.map((category) => (
                <Link
                  key={category.slug}
                  href={`/explore?category=${encodeURIComponent(category.slug)}`}
                  className="group flex w-[86px] shrink-0 flex-col items-center gap-2"
                >
                  <div className="flex h-[78px] w-[78px] items-center justify-center rounded-full border border-zinc-700 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] text-center text-[10px] font-medium leading-4 text-zinc-200 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition duration-300 group-hover:-translate-y-1 group-hover:border-violet-400/20 group-hover:bg-violet-500/10 group-hover:text-white sm:text-[11px]">
                    <span className="line-clamp-2 px-2 break-words">{category.name}</span>
                  </div>

                  <span className="max-w-[86px] text-center text-xs leading-4 text-zinc-500 group-hover:text-zinc-300">
                    {category.count} post{category.count === 1 ? '' : 's'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}