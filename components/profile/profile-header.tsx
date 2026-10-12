import Link from 'next/link'
import { Plus, Settings } from 'lucide-react'
import { CopyProfileLinkButton } from '@/components/profile/copy-profile-link-button'
import { FollowButton } from '@/components/profile/follow-button'
import { SmartImage } from '@/components/ui/smart-image'

type ProfileHeaderProps = {
  profile: { id: string; username: string; display_name: string; bio?: string | null; avatar_url?: string | null }
  viewerProfileId: string | null
  counts: { postCount: number; followerCount: number; followingCount: number }
  avatarUrl?: string | null
  isOwnProfile: boolean
  followedByMe?: boolean
  returnTo?: string
  categoryHighlights?: Array<{ slug: string; name: string; count: number }>
  canMessage?: boolean
}

export function ProfileHeader({ profile, viewerProfileId, counts, avatarUrl, isOwnProfile,
  followedByMe = false, returnTo, categoryHighlights = [], canMessage = false,
}: ProfileHeaderProps) {
  const profileHref = isOwnProfile ? '/profile' : '/profile/' + encodeURIComponent(profile.id)
  const safeReturnTo = returnTo || profileHref
  const formatCount = (value: number) => new Intl.NumberFormat('en-IN').format(value)
  const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800'

  return (
    <section className="border-b border-zinc-800 pb-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <SmartImage src={avatarUrl} alt={profile.display_name}
          className="h-20 w-20 shrink-0 rounded-full border border-zinc-700 object-cover sm:h-28 sm:w-28"
          fallbackClassName="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xl text-zinc-300 sm:h-28 sm:w-28"
          fallbackText={(profile.display_name || profile.username).slice(0, 1).toUpperCase()} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold tracking-tight text-white sm:text-2xl">{profile.display_name}</h1>
              <p className="mt-1 break-all text-sm text-zinc-400">@{profile.username}</p>
            </div>
            {isOwnProfile ? <Link href="/settings" aria-label="Open settings" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white"><Settings className="h-5 w-5" /></Link> : null}
          </div>
          {profile.bio?.trim() ? <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-zinc-200">{profile.bio}</p> : null}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <Link href={profileHref} className="inline-flex min-h-11 items-center gap-1.5 text-zinc-400 hover:text-white"><strong className="text-white">{formatCount(counts.postCount)}</strong> posts</Link>
        <Link href={profileHref + '/followers'} className="inline-flex min-h-11 items-center gap-1.5 text-zinc-400 hover:text-white"><strong className="text-white">{formatCount(counts.followerCount)}</strong> followers</Link>
        <Link href={profileHref + '/following'} className="inline-flex min-h-11 items-center gap-1.5 text-zinc-400 hover:text-white"><strong className="text-white">{formatCount(counts.followingCount)}</strong> following</Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isOwnProfile ? <>
          <Link href="/profile/edit" className={buttonClass}>Edit profile</Link>
          <Link href="/stories/create" className={buttonClass}><Plus className="mr-2 h-4 w-4" />Add story</Link>
        </> : <>
          <FollowButton followerId={viewerProfileId} followingId={profile.id} followedByMe={followedByMe} returnTo={safeReturnTo} />
          {canMessage ? <Link href={'/messages?with=' + encodeURIComponent(profile.id)} className={buttonClass}>Message</Link> : null}
        </>}
        <CopyProfileLinkButton profileId={profile.id} />
      </div>
      {categoryHighlights.length ? <div className="mt-4 flex flex-wrap gap-2" aria-label="Post topics">
        {categoryHighlights.map(category => <Link key={category.slug} href={'/explore?category=' + encodeURIComponent(category.slug)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-violet-300 hover:bg-violet-500/10">
          {category.name}<span className="text-xs text-zinc-400">{category.count}</span>
        </Link>)}
      </div> : null}
    </section>
  )
}
