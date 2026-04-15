'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useFormStatus } from 'react-dom'
import { createComment } from '@/actions/comments'

type CommentFormProps = {
  postId: string
  profileId: string
  returnTo?: string
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      type="submit"
      disabled={pending || disabled}
      className="rounded-full bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700"
    >
      {pending ? 'Posting...' : 'Post'}
    </motion.button>
  )
}

export function CommentForm({
  postId,
  profileId,
  returnTo = '/feed',
}: CommentFormProps) {
  const [value, setValue] = useState('')
  const trimmedLength = useMemo(() => value.trim().length, [value])

  return (
    <form action={createComment}>
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="return_to" value={returnTo} />

      <motion.div
        whileHover={{ y: -1 }}
        className="rounded-[24px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(9,9,12,0.96))] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
      >
        <div className="flex flex-col gap-3">
          <textarea
            name="body"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a comment..."
            maxLength={280}
            rows={2}
            className="min-h-[88px] w-full resize-none rounded-2xl border border-zinc-700 bg-black/80 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/30 focus:shadow-[0_0_0_1px_rgba(120,119,255,0.12)]"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">{value.length}/280</p>
            <SubmitButton disabled={trimmedLength === 0} />
          </div>
        </div>
      </motion.div>
    </form>
  )
}