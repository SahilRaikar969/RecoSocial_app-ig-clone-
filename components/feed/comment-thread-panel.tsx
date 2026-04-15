'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { createCommentInline } from '@/actions/comments'

type CommentAuthor = {
  id?: string | null
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

type InitialComment = {
  id: string
  author_id: string
  body: string
  created_at: string
  author?: CommentAuthor | null
}

type CommentThreadPanelProps = {
  postId: string
  profileId: string
  returnTo: string
  initialComments: InitialComment[]
  showAllComments?: boolean
  postOwnerId?: string
}

function formatDateStable(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())

  return `${day}/${month}/${year}`
}

function getProfileHref(profileId: string | null | undefined, viewerProfileId?: string) {
  const safeProfileId = String(profileId || '').trim()
  if (!safeProfileId) return '/profile'
  if (viewerProfileId && safeProfileId === viewerProfileId) return '/profile'
  return `/profile/${safeProfileId}`
}

export function CommentThreadPanel({
  postId,
  profileId,
  returnTo,
  initialComments,
  showAllComments = false,
}: CommentThreadPanelProps) {
  const [comments, setComments] = useState<InitialComment[]>(initialComments)
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  const visibleComments = useMemo(() => {
    if (showAllComments) return comments
    return comments.slice(0, 2)
  }, [comments, showAllComments])

  const trimmedLength = value.trim().length

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmedLength === 0 || isPending) return

    const previousComments = comments
    const optimisticComment: InitialComment = {
      id: `temp-${Date.now()}`,
      author_id: profileId,
      body: value.trim(),
      created_at: new Date().toISOString(),
      author: {
        id: profileId,
        username: 'you',
        display_name: 'You',
        avatar_url: null,
      },
    }

    setComments((current) => [optimisticComment, ...current])
    setValue('')

    startTransition(async () => {
      const result = await createCommentInline({
        postId,
        profileId,
        body: optimisticComment.body,
        returnTo,
      })

      if (!result.ok) {
        setComments(previousComments)
        setValue(optimisticComment.body)
        return
      }

      setComments((current) => {
        const withoutTemp = current.filter((item) => item.id !== optimisticComment.id)
        return [result.comment, ...withoutTemp]
      })
    })
  }

  return (
    <>
      {visibleComments.length > 0 ? (
        <div className="space-y-3">
          {visibleComments.map((comment) => {
            const commentAuthorName = comment.author?.display_name || 'User'
            const commentAuthorUsername = comment.author?.username || 'user'
            const commentProfileHref = getProfileHref(
              comment.author?.id ?? comment.author_id,
              profileId
            )

            return (
              <div
                key={comment.id}
                className="rounded-[22px] border border-zinc-800 bg-zinc-950/80 px-4 py-4 transition hover:border-zinc-700"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-900 text-[10px] uppercase tracking-[0.16em] text-zinc-500 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                    User
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-7 text-zinc-200">
                      <Link
                        href={commentProfileHref}
                        className="mr-2 font-semibold text-white transition hover:text-zinc-300"
                      >
                        {commentAuthorUsername}
                      </Link>
                      {comment.body}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>{formatDateStable(comment.created_at)}</span>
                      <span>{commentAuthorName}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className={visibleComments.length > 0 ? 'mt-4 border-t border-zinc-800/80 pt-4' : ''}>
        <form onSubmit={handleSubmit}>
          <div className="rounded-[24px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(9,9,12,0.96))] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
            <div className="flex flex-col gap-3">
              <textarea
                name="body"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Write a comment..."
                maxLength={280}
                rows={2}
                className="min-h-[88px] w-full resize-none rounded-2xl border border-zinc-700 bg-black/80 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-violet-500/30 focus:shadow-[0_0_0_1px_rgba(120,119,255,0.12)]"
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">{value.length}/280</p>
                <button
                  type="submit"
                  disabled={isPending || trimmedLength === 0}
                  className="rounded-full bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-4 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700"
                >
                  {isPending ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}