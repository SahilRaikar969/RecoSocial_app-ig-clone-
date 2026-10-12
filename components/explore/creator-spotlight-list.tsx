import { NavigationLink as Link } from '@/components/ui/navigation-link'
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
  viewerProfileId: string | null
  returnTo: string
  activeCategory?: string
}


export async function CreatorSpotlightList({ creators, viewerProfileId, returnTo, activeCategory = '' }: CreatorSpotlightListProps) {
  if (!creators.length) return null
  const resolvedCreators = await Promise.all(creators.map(async creator => ({
    ...creator, resolved_avatar_url: await getMediaUrl(creator.avatar_url ?? null),
  })))

  return (
    <section aria-label="Discover creators">
      <h2 className="mb-3 text-lg font-semibold text-white">{activeCategory ? 'Creators in this topic' : 'Discover creators'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {resolvedCreators.map(creator => {
          const profileHref = creator.id === viewerProfileId ? '/profile' : '/profile/' + creator.id
          const name = creator.display_name || creator.username || 'Creator'
          return (
            <article key={creator.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={profileHref} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
                  <SmartImage src={creator.resolved_avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" fallbackClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300" fallbackText={name.slice(0, 1).toUpperCase()} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{name}</p>
                    <p className="truncate text-xs text-zinc-400">@{creator.username || 'creator'}</p>
                  </div>
                </Link>
                {creator.id !== viewerProfileId ? <FollowButton followerId={viewerProfileId} followingId={creator.id} followedByMe={creator.followed_by_me} returnTo={returnTo} /> : <span className="text-xs text-zinc-400">You</span>}
              </div>
              {creator.bio ? <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-zinc-300">{creator.bio}</p> : null}
              {creator.follows_you ? <p className="mt-2 text-xs text-zinc-400">Follows you</p> : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
