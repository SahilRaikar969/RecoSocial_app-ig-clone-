import { NavigationLink as Link } from '@/components/ui/navigation-link'
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
  viewerProfileId: string | null
  creators: SearchCreator[]
  posts: SearchPost[]
}


export async function SearchResults({ query, activeCategory = '', viewerProfileId, creators, posts }: SearchResultsProps) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return null
  const resolvedCreators = await Promise.all(creators.map(async creator => ({
    ...creator, resolved_avatar_url: await getMediaUrl(creator.avatar_url ?? null),
  })))
  const returnTo = '/explore?' + new URLSearchParams({ q: trimmedQuery, ...(activeCategory ? { category: activeCategory } : {}) }).toString()

  if (!resolvedCreators.length && !posts.length) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-10 text-center">
        <h2 className="break-words text-lg font-semibold text-white">No results for “{trimmedQuery}”</h2>
        <p className="mt-2 text-sm text-zinc-400">Try another name, keyword or topic.</p>
        <Link href={activeCategory ? '/explore?category=' + encodeURIComponent(activeCategory) : '/explore'} className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm font-semibold hover:bg-zinc-800">Clear search</Link>
      </section>
    )
  }

  return (
    <section aria-label="Search results" className="space-y-6">
      <h2 className="break-words text-lg font-semibold text-white">Results for “{trimmedQuery}”</h2>
      <section aria-label="Creator results">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Creators <span className="font-normal text-zinc-400">({resolvedCreators.length})</span></h3>
        {resolvedCreators.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {resolvedCreators.slice(0, 6).map(creator => {
              const name = creator.display_name || creator.username || 'Creator'
              const href = creator.id === viewerProfileId ? '/profile' : '/profile/' + creator.id
              return (
                <article key={creator.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
                      <SmartImage src={creator.resolved_avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" fallbackClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300" fallbackText={name.slice(0, 1).toUpperCase()} />
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{name}</p><p className="truncate text-xs text-zinc-400">@{creator.username || 'creator'}</p></div>
                    </Link>
                    {creator.id !== viewerProfileId ? <FollowButton followerId={viewerProfileId} followingId={creator.id} followedByMe={creator.followed_by_me} returnTo={returnTo} /> : <span className="text-xs text-zinc-400">You</span>}
                  </div>
                  {creator.bio ? <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-zinc-300">{creator.bio}</p> : null}
                </article>
              )
            })}
          </div>
        ) : <p className="text-sm text-zinc-400">No creators matched this search.</p>}
      </section>
      <section aria-label="Post results">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Posts <span className="font-normal text-zinc-400">({posts.length})</span></h3>
        {posts.length ? <ProfilePostGrid posts={posts} openContext={{ source: 'explore', category: activeCategory, query }} emptyTitle="No posts found" emptyBody="Try another keyword or topic." /> : <p className="text-sm text-zinc-400">No posts matched this search.</p>}
      </section>
    </section>
  )
}
