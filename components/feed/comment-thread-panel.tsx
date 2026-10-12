'use client'

import { AuthPromptLink } from '@/components/auth/auth-prompt-link'
import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useOptimistic, useState, useTransition } from 'react'
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
  profileId: string | null
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

function getProfileHref(profileId: string | null | null | undefined, viewerProfileId?: string | null) {
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
  const router = useRouter()
  const inputId = useId()
  const countId = inputId + "-count"
  const errorId = inputId + "-error"
  const [comments, addOptimisticComment] = useOptimistic(
    initialComments,
    (current, comment: InitialComment) => [comment, ...current.filter((item) => item.id !== comment.id)]
  )
  const [mutationError, setMutationError] = useState('')
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  const visibleComments = useMemo(() => {
    if (showAllComments) return comments
    return comments.slice(0, 2)
  }, [comments, showAllComments])

  const trimmedLength = value.trim().length

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (trimmedLength === 0 || isPending || !profileId) return

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

    setMutationError('')

    startTransition(async () => {
      addOptimisticComment(optimisticComment)
      try {
        const result = await createCommentInline({
          postId,
          profileId,
          body: optimisticComment.body,
          returnTo,
        })
        if (!result.ok) {
          setMutationError('Could not confirm the comment. Check the refreshed comments before posting again.')
          router.refresh()
          return
        }
        setValue('')
      } catch {
        setMutationError('Could not confirm the comment. Check the refreshed comments before posting again.')
        router.refresh()
      }
    })
  }

  return (
    <section aria-label="Comments">
      <h3 className="mb-3 text-sm font-semibold text-white">Comments</h3>
      {visibleComments.length > 0 ? (
        <ul className="space-y-4">
          {visibleComments.map(comment => {
            const username = comment.author?.username || 'user'
            const profileHref = getProfileHref(comment.author?.id ?? comment.author_id, profileId)
            return (
              <li key={comment.id} className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">{username.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200"><Link href={profileHref} className="mr-2 font-semibold text-white hover:underline">{username}</Link>{comment.body}</p>
                  <time dateTime={comment.created_at} className="mt-1 block text-xs text-zinc-400">{formatDateStable(comment.created_at)}</time>
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="text-sm text-zinc-400">No comments yet.</p>}
      <>{!profileId ? <AuthPromptLink returnTo={returnTo} action="comment">Sign in to comment</AuthPromptLink> : <form onSubmit={handleSubmit} aria-busy={isPending} className="mt-4 border-t border-zinc-800 pt-4">
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-zinc-200">Add a comment</label>
        {mutationError ? <p id={errorId} role="alert" className="mb-3 text-sm text-red-300">{mutationError}</p> : null}
        <textarea id={inputId} name="body" disabled={isPending} value={value} onChange={event => setValue(event.target.value)} placeholder="Write a comment…" maxLength={280} rows={2} aria-describedby={countId + (mutationError ? ' ' + errorId : '')} className="min-h-24 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-base leading-6 text-white placeholder:text-zinc-400 disabled:opacity-60" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p id={countId} className="text-xs text-zinc-400">{value.length}/280 characters</p>
          <button type="submit" disabled={isPending || trimmedLength === 0} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-400">{isPending ? 'Posting…' : 'Post'}</button>
        </div>
        <span role="status" className="sr-only">{isPending ? 'Posting comment…' : ''}</span>
      </form>}</>
    </section>
  )
}
