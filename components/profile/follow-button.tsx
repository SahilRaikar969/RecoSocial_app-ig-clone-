'use client'

import { useFormStatus } from 'react-dom'
import { toggleFollow } from '@/actions/follows'

type FollowButtonProps = { followerId: string; followingId: string; followedByMe: boolean; returnTo: string }

function FollowSubmit({ followedByMe }: { followedByMe: boolean }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} aria-pressed={followedByMe}
    className={'inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold disabled:opacity-60 ' + (followedByMe ? 'border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800' : 'border-violet-500 bg-violet-600 text-white hover:bg-violet-500')}>
    {pending ? 'Updating…' : followedByMe ? 'Following' : 'Follow'}
  </button>
}

export function FollowButton({ followerId, followingId, followedByMe, returnTo }: FollowButtonProps) {
  return <form action={toggleFollow}>
    <input type="hidden" name="follower_id" value={followerId} />
    <input type="hidden" name="following_id" value={followingId} />
    <input type="hidden" name="followed" value={followedByMe ? 'true' : 'false'} />
    <input type="hidden" name="return_to" value={returnTo} />
    <FollowSubmit followedByMe={followedByMe} />
  </form>
}
