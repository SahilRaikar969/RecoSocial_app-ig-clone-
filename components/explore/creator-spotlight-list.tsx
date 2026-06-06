import Link from 'next/link'
import { Compass, Sparkles, TrendingUp } from 'lucide-react'
import { FollowButton } from '@/components/profile/follow-button'
import { SmartImage } from '@/components/ui/smart-image'
import { getMediaUrl } from '@/lib/media/get-media-url'

type CreatorSpotlight = {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  followed_by_me: boolean
  follows_you?: boolean | null
  follower_count?: number | null
  post_count?: number | null
  spotlight_reason?: string | null
  top_categories?: Array<{
    id: string
    name: string
    slug: string
  }> | null
}

type CreatorSpotlightListProps = {
  creators: CreatorSpotlight[]
  viewerProfileId: string
  returnTo: string
  activeCategory?: string
}

function formatCompactNumber(value?: number | null) {
  const safeValue = Number(value || 0)

  if (safeValue >= 1_000_000) {
    return `${(safeValue / 1_000_000).toFixed(safeValue >= 10_000_000 ? 0 : 1)}M`
  }

  if (safeValue >= 1_000) {
    return `${(safeValue / 1_000).toFixed(safeValue >= 10_000 ? 0 : 1)}K`
  }

  return String(safeValue)
}

export async function CreatorSpotlightList({
  creators,
  viewerProfileId,
  returnTo,
  activeCategory = '',
}: CreatorSpotlightListProps) {
  if (!creators.length) {
    return (
      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

        <div className="relative flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-800 bg-zinc-950/80 px-6 text-center">
          <div className="rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
            Creator spotlight
          </div>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            No creators to spotlight yet
          </h2>

          <p className="mt-3 max-w-md text-sm leading-7 text-zinc-300">
            More creators will appear here as recommendation signals and content volume grow.
          </p>
        </div>
      </section>
    )
  }

  const resolvedCreators = await Promise.all(
    creators.map(async (creator) => ({
      ...creator,
      resolved_avatar_url: await getMediaUrl(creator.avatar_url ?? null),
    }))
  )

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_26%)]" />

      <div className="relative border-b border-zinc-800/80 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              Creator spotlight
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Creators worth opening next
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
              Explore keeps creator discovery visible, so recommendation quality does not collapse into posts only.
              {activeCategory ? ' Spotlighting is currently shaped by the active topic.' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              {resolvedCreators.length} creators
            </span>
            {activeCategory ? (
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white">
                Topic active
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2 xl:grid-cols-3">
        {resolvedCreators.map((creator) => {
          const profileHref =
            creator.id === viewerProfileId ? '/profile' : `/profile/${creator.id}`

          const creatorDisplayName = creator.display_name || 'Creator'
          const creatorUsername = creator.username || 'creator'
          const creatorBio = creator.bio || 'No bio added yet.'
          const creatorTopCategories = Array.isArray(creator.top_categories)
            ? creator.top_categories
            : []

          const creatorStatus =
            creator.id === viewerProfileId
              ? 'You'
              : creator.followed_by_me
                ? 'Following'
                : creator.follows_you
                  ? 'Follows you'
                  : 'Discover'

          return (
            <article
              key={creator.id}
              className="group relative overflow-hidden rounded-[30px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_80px_rgba(0,0,0,0.38)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_26%)] opacity-80" />

              <div className="relative px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={profileHref}
                    className="flex min-w-0 items-start gap-3 rounded-2xl transition hover:opacity-90"
                  >
                    <SmartImage
                      src={creator.resolved_avatar_url}
                      alt={creatorDisplayName}
                      className="h-14 w-14 rounded-full border border-white/10 object-cover ring-2 ring-white/5"
                      fallbackClassName="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-black text-[10px] uppercase tracking-[0.16em] text-zinc-500"
                      fallbackText="User"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-white">
                          {creatorDisplayName}
                        </p>

                        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                          {creatorStatus}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-zinc-400">@{creatorUsername}</p>
                    </div>
                  </Link>

                  {creator.id !== viewerProfileId ? (
                    <FollowButton
                      followerId={viewerProfileId}
                      followingId={creator.id}
                      followedByMe={creator.followed_by_me}
                      returnTo={returnTo}
                    />
                  ) : null}
                </div>

                <div className="mt-4 rounded-[24px] border border-zinc-800 bg-black/65 px-4 py-4">
                  <p className="line-clamp-3 text-sm leading-7 text-zinc-300">
                    {creatorBio}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center transition hover:border-white/20">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      Followers
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatCompactNumber(creator.follower_count)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center transition hover:border-white/20">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      Posts
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatCompactNumber(creator.post_count)}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center transition hover:border-white/20">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      Open
                    </p>
                    <p className="mt-2 text-xs font-medium text-zinc-300">
                      Profile
                    </p>
                  </div>
                </div>

                {creatorTopCategories.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {creatorTopCategories.slice(0, 3).map((category) => (
                      <Link
                        key={category.id}
                        href={`/explore?category=${encodeURIComponent(category.slug)}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-violet-400/20 hover:bg-violet-500/10 hover:text-white"
                      >
                        <Compass className="h-3 w-3" />
                        {category.name}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {creator.spotlight_reason ? (
                  <div className="mt-4 rounded-[24px] border border-emerald-900/40 bg-emerald-950/30 px-4 py-4 shadow-[0_10px_30px_rgba(16,185,129,0.06)]">
                    <div className="flex items-center gap-2 text-emerald-200">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <p className="text-[11px] uppercase tracking-[0.16em]">
                        Why this creator
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-100">
                      {creator.spotlight_reason}
                    </p>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}