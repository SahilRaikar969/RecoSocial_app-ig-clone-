import Link from 'next/link'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { FollowButton } from '@/components/profile/follow-button'
import { ProfilePostGrid } from '@/components/profile/profile-post-grid'
import { SmartImage } from '@/components/ui/smart-image'
import { getMediaUrl } from '@/lib/media/get-media-url'

type SearchCreator = {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  followed_by_me: boolean
  follows_you?: boolean | null
  follower_count?: number | null
  post_count?: number | null
}

type SearchPost = {
  id: string
  author_id: string
  caption: string | null
  media_type: string
  media_path: string
  thumbnail_path?: string | null
  like_count?: number
  comment_count?: number
  save_count?: number
  resolved_media_url?: string | null
  resolved_thumbnail_url?: string | null
}

type SearchResultsProps = {
  query: string
  activeCategory?: string
  viewerProfileId: string
  creators: SearchCreator[]
  posts: SearchPost[]
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

export async function SearchResults({
  query,
  activeCategory = '',
  viewerProfileId,
  creators,
  posts,
}: SearchResultsProps) {
  const trimmedQuery = query.trim()
  const shouldShow = Boolean(trimmedQuery)

  if (!shouldShow) {
    return null
  }

  const resolvedCreators = await Promise.all(
    creators.map(async (creator) => ({
      ...creator,
      resolved_avatar_url: await getMediaUrl(creator.avatar_url ?? null),
    }))
  )

  const noResults = resolvedCreators.length === 0 && posts.length === 0
  const returnTo = `/explore?${new URLSearchParams({
    q: trimmedQuery,
    ...(activeCategory ? { category: activeCategory } : {}),
  }).toString()}`

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

      <div className="relative border-b border-zinc-800/80 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200">
              Search results
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Results for “{trimmedQuery}”
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
              Creator matches and caption-level post matches stay inside the current discovery surface
              {activeCategory ? ', while keeping the active topic filter attached.' : '.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              {resolvedCreators.length} creators
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
              {posts.length} posts
            </span>
            {activeCategory ? (
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white">
                Topic active
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative space-y-8 px-5 py-5 sm:px-6">
        {noResults ? (
          <div className="rounded-[30px] border border-dashed border-zinc-800 bg-zinc-950/80 px-6 py-12 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
              <Search className="h-3.5 w-3.5" />
              No matches
            </div>

            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">
              Nothing matched this search
            </h3>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-300">
              Try broader keywords, switch the active topic, or reopen the full discovery surface to widen creator and post matching.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={activeCategory ? `/explore?category=${encodeURIComponent(activeCategory)}` : '/explore'}
                className="rounded-2xl border border-white/10 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:-translate-y-0.5 hover:border-white/25 hover:text-white"
              >
                Clear search
              </Link>

              <Link
                href="/feed"
                className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white px-5 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:opacity-90"
              >
                Back to feed
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="relative overflow-hidden rounded-[30px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.26)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.10),transparent_30%)]" />

            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Creator matches
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Profiles related to this search
                  </h3>
                </div>

                <div className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                  {resolvedCreators.length} found
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {resolvedCreators.length > 0 ? (
                  resolvedCreators.slice(0, 6).map((creator) => {
                    const creatorDisplayName = creator.display_name || 'Creator'
                    const creatorUsername = creator.username || 'creator'
                    const creatorBio = creator.bio || 'No bio added yet.'
                    const creatorHref =
                      creator.id === viewerProfileId ? '/profile' : `/profile/${creator.id}`

                    return (
                      <article
                        key={creator.id}
                        className="group rounded-[24px] border border-zinc-800 bg-black/65 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-black/80"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <Link
                            href={creatorHref}
                            className="flex min-w-0 items-start gap-3 rounded-2xl transition hover:opacity-90"
                          >
                            <SmartImage
                              src={creator.resolved_avatar_url}
                              alt={creatorDisplayName}
                              className="h-12 w-12 rounded-full border border-white/10 object-cover ring-2 ring-white/5"
                              fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
                              fallbackText="User"
                            />

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-white">
                                  {creatorDisplayName}
                                </p>

                                {creator.id === viewerProfileId ? (
                                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                    You
                                  </span>
                                ) : creator.followed_by_me ? (
                                  <span className="rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                                    Following
                                  </span>
                                ) : creator.follows_you ? (
                                  <span className="rounded-full border border-white/10 bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                                    Follows you
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-1 text-sm text-zinc-500">@{creatorUsername}</p>

                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
                                {creatorBio}
                              </p>
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

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                              Followers
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {formatCompactNumber(creator.follower_count)}
                            </p>
                          </div>

                          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                              Posts
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {formatCompactNumber(creator.post_count)}
                            </p>
                          </div>

                          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                              Action
                            </p>
                            <p className="mt-2 text-xs font-medium text-zinc-300">
                              {creator.id === viewerProfileId ? 'Open profile' : 'Open creator'}
                            </p>
                          </div>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-zinc-800 bg-black px-4 py-6 text-sm text-zinc-500">
                    No creators matched this query.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.26)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Caption matches
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Posts related to this search
                  </h3>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  {posts.length} found
                </div>
              </div>

              <div className="mt-4">
                {posts.length > 0 ? (
                  <ProfilePostGrid
                    posts={posts}
                    openContext={{ source: 'explore', category: activeCategory, query }}
                    emptyTitle="No post matches yet"
                    emptyBody="No caption-level post matches were found."
                  />
                ) : (
                  <div className="rounded-[24px] border border-dashed border-zinc-800 bg-black px-4 py-6 text-sm text-zinc-500">
                    No posts matched this query.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}