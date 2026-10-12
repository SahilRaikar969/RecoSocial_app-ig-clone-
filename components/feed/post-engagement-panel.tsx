'use client'

import { AuthPromptLink } from '@/components/auth/auth-prompt-link'
import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { useRouter } from 'next/navigation'
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react'
import { useId, useOptimistic, useState, useTransition } from 'react'
import { toggleLikeInline } from '@/actions/likes'
import { toggleSaveInline } from '@/actions/saves'
import { optimisticEngagement } from '@/lib/mutations/optimistic-engagement'

type PostEngagementPanelProps = {
  postId: string
  devProfileId: string | null
  returnTo: string
  initialLikedByMe: boolean
  initialSavedByMe: boolean
  initialLikeCount: number
  initialSaveCount: number
  commentCount: number
  commentsHref: string
  commentsLabel: string
  secondaryHref?: string
  secondaryAriaLabel?: string
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  }
  return String(value)
}

export function PostEngagementPanel({
  postId,
  devProfileId,
  returnTo,
  initialLikedByMe,
  initialSavedByMe,
  initialLikeCount,
  initialSaveCount,
  commentCount,
  commentsHref,
  commentsLabel,
  secondaryHref,
  secondaryAriaLabel = 'Open post',
}: PostEngagementPanelProps) {
  const router = useRouter()
  const countId = useId()
  const [{ active: likedByMe, count: likeCount }, setLikeOptimistic] = useOptimistic(
    { active: initialLikedByMe, count: initialLikeCount }, optimisticEngagement
  )
  const [{ active: savedByMe, count: saveCount }, setSaveOptimistic] = useOptimistic(
    { active: initialSavedByMe, count: initialSaveCount }, optimisticEngagement
  )
  const [mutationError, setMutationError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [isPendingLike, startLikeTransition] = useTransition()
  const [isPendingSave, startSaveTransition] = useTransition()

  async function handleCopyLink() {
    try {
      const href = new URL(secondaryHref || '/post/' + postId, window.location.origin)
      await navigator.clipboard.writeText(href.toString())
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  function handleToggleLike() {
    if (isPendingLike || !devProfileId) return
    const previous = likedByMe
    setMutationError('')
    startLikeTransition(async () => {
      setLikeOptimistic(!previous)
      try {
        const result = await toggleLikeInline({
          postId: postId,
          devProfileId: devProfileId,
          liked: previous,
          returnTo: returnTo,
        })
        if (!result.ok) {
          setMutationError('Could not confirm the like change. Refreshing its current state.')
          router.refresh()
        }
      } catch {
        setMutationError('Could not confirm the like change. Refreshing its current state.')
        router.refresh()
      }
    })
  }

  function handleToggleSave() {
    if (isPendingSave || !devProfileId) return
    const previous = savedByMe
    setMutationError('')
    startSaveTransition(async () => {
      setSaveOptimistic(!previous)
      try {
        const result = await toggleSaveInline({
          postId: postId,
          devProfileId: devProfileId,
          saved: previous,
          returnTo: returnTo,
        })
        if (!result.ok) {
          setMutationError('Could not confirm the save change. Refreshing its current state.')
          router.refresh()
        }
      } catch {
        setMutationError('Could not confirm the save change. Refreshing its current state.')
        router.refresh()
      }
    })
  }

  return (
    <div>
      {mutationError ? <p role="alert" className="mb-3 text-sm text-red-300">{mutationError}</p> : null}
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <>{!devProfileId ? <AuthPromptLink returnTo={returnTo} action="like"><Heart aria-hidden="true" className="h-5 w-5" />Like · {initialLikeCount}</AuthPromptLink> : <button type="button" onClick={handleToggleLike} disabled={isPendingLike} aria-pressed={likedByMe} aria-label={likedByMe ? 'Unlike post' : 'Like post'} aria-describedby={countId + '-likes'} className={'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-sm transition disabled:opacity-60 ' + (likedByMe ? 'bg-violet-500/10 text-violet-300' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white')}>
          <Heart aria-hidden="true" className="h-5 w-5" fill={likedByMe ? 'currentColor' : 'none'} />
          <span aria-hidden="true">{formatCompactNumber(likeCount)}</span><span id={countId + '-likes'} className="sr-only">{likeCount} likes</span>
        </button>}</>
        <Link href={commentsHref} aria-label={'View ' + commentCount + (commentCount === 1 ? ' comment' : ' comments')} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white">
          <MessageCircle aria-hidden="true" className="h-5 w-5" /><span aria-hidden="true">{formatCompactNumber(commentCount)}</span>
        </Link>
        <>{!devProfileId ? <AuthPromptLink returnTo={returnTo} action="save"><Bookmark aria-hidden="true" className="h-5 w-5" />Save · {initialSaveCount}</AuthPromptLink> : <button type="button" onClick={handleToggleSave} disabled={isPendingSave} aria-pressed={savedByMe} aria-label={savedByMe ? 'Unsave post' : 'Save post'} aria-describedby={countId + '-saves'} className={'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-sm transition disabled:opacity-60 ' + (savedByMe ? 'bg-violet-500/10 text-violet-300' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white')}>
          <Bookmark aria-hidden="true" className="h-5 w-5" fill={savedByMe ? 'currentColor' : 'none'} /><span aria-hidden="true">{formatCompactNumber(saveCount)}</span><span id={countId + '-saves'} className="sr-only">{saveCount} saves</span>
        </button>}</>
        <button type="button" onClick={handleCopyLink} aria-label="Copy post link" className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-white"><Share2 aria-hidden="true" className="h-5 w-5" /></button>
      </div>
      <p role="status" className={copyState === 'idle' ? 'sr-only' : 'mt-2 text-sm text-zinc-300'}>{copyState === 'copied' ? 'Post link copied.' : copyState === 'failed' ? 'Could not copy the link. Open the post and copy its address.' : ''}</p>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <Link href={commentsHref} className="inline-flex min-h-11 items-center text-sm text-zinc-400 hover:text-white">{commentsLabel || (commentCount ? 'View comments' : 'Add a comment')}</Link>
        {secondaryHref && secondaryHref !== commentsHref ? <Link href={secondaryHref} className="inline-flex min-h-11 items-center text-sm font-medium text-violet-300 hover:text-violet-200">{secondaryAriaLabel}</Link> : null}
      </div>
    </div>
  )
}
