'use client'

import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFormStatus } from 'react-dom'
import { toggleLike } from '@/actions/likes'

type LikeButtonProps = {
  postId: string
  devProfileId: string
  likedByMe: boolean
  returnTo?: string
}

function SubmitButton({ likedByMe }: { likedByMe: boolean }) {
  const { pending } = useFormStatus()

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -1 }}
      type="submit"
      disabled={pending}
      aria-label={likedByMe ? 'Unlike post' : 'Like post'}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition disabled:cursor-not-allowed ${
        likedByMe
          ? 'border-white/15 bg-zinc-900 text-white hover:border-zinc-600 disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500'
          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white disabled:border-zinc-800 disabled:text-zinc-600'
      }`}
    >
      <motion.span
        animate={likedByMe ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ duration: 0.22 }}
      >
        <Heart className="h-4.5 w-4.5" />
      </motion.span>
    </motion.button>
  )
}

export function LikeButton({
  postId,
  devProfileId,
  likedByMe,
  returnTo = '/feed',
}: LikeButtonProps) {
  return (
    <form action={toggleLike}>
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="dev_profile_id" value={devProfileId} />
      <input type="hidden" name="liked" value={likedByMe ? 'true' : 'false'} />
      <input type="hidden" name="return_to" value={returnTo} />
      <SubmitButton likedByMe={likedByMe} />
    </form>
  )
}