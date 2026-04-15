'use client'

import { useRef, useTransition } from 'react'
import { toggleFollow } from '@/actions/follows'

type FollowButtonProps = {
  followerId: string
  followingId: string
  followedByMe: boolean
  returnTo: string
}

export function FollowButton({
  followerId,
  followingId,
  followedByMe,
  returnTo,
}: FollowButtonProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!formRef.current) return

    startTransition(() => {
      formRef.current?.requestSubmit()
    })
  }

  return (
    <>
      <form ref={formRef} action={toggleFollow} className="hidden">
        <input type="hidden" name="follower_id" value={followerId} />
        <input type="hidden" name="following_id" value={followingId} />
        <input type="hidden" name="followed" value={followedByMe ? 'true' : 'false'} />
        <input type="hidden" name="return_to" value={returnTo} />
      </form>

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
          followedByMe
            ? 'border-zinc-700 bg-zinc-950/85 text-white hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900'
            : 'border-white bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] !text-black shadow-[0_14px_32px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:opacity-90'
        } disabled:cursor-not-allowed disabled:opacity-70`}
      >
        {isPending ? (followedByMe ? 'Updating...' : 'Following...') : followedByMe ? 'Following' : 'Follow'}
      </button>
    </>
  )
}