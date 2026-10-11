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

export async function NetworkProfileList({ profiles, viewerProfileId, returnTo, emptyTitle, emptyBody }: NetworkProfileListProps) {
  if (!profiles.length) return <section className="rounded-xl border border-dashed border-zinc-700 px-5 py-10 text-center"><h2 className="text-lg font-semibold text-white">{emptyTitle}</h2><p className="mt-2 text-sm text-zinc-400">{emptyBody}</p></section>

  return <div className="divide-y divide-zinc-800">
    {await Promise.all(profiles.map(async profile => {
      const avatarUrl = await getMediaUrl(profile.avatar_url ?? null)
      const href = profile.is_viewer ? '/profile' : '/profile/' + profile.id
      const relationship = profile.is_viewer ? 'You' : profile.is_mutual ? 'Mutual follow' : profile.followed_by_me ? 'Following' : profile.follows_you ? 'Follows you' : ''
      return <article key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
          <SmartImage src={avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" fallbackClassName="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300" fallbackText={profile.username.slice(0, 1).toUpperCase()} />
          <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-white">{profile.display_name}</h2><p className="truncate text-sm text-zinc-400">@{profile.username}</p>{relationship ? <p className="mt-1 text-xs text-zinc-400">{relationship}</p> : null}</div>
        </Link>
        {!profile.is_viewer ? <FollowButton followerId={viewerProfileId} followingId={profile.id} followedByMe={profile.followed_by_me} returnTo={returnTo} /> : null}
        {profile.bio ? <p className="basis-full break-words text-sm leading-6 text-zinc-300">{profile.bio}</p> : null}
      </article>
    }))}
  </div>
}
