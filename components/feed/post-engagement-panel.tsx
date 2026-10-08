'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react'
import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { toggleLikeInline } from '@/actions/likes'
import { toggleSaveInline } from '@/actions/saves'
import { optimisticEngagement } from '@/lib/mutations/optimistic-engagement'

type PostEngagementPanelProps = {
  postId: string
  devProfileId: string
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
  secondaryAriaLabel = 'Open secondary media route',
}: PostEngagementPanelProps) {
  const router = useRouter()
  const [{ active: likedByMe, count: likeCount }, setLikeOptimistic] = useOptimistic(
    { active: initialLikedByMe, count: initialLikeCount }, optimisticEngagement
  )
  const [{ active: savedByMe, count: saveCount }, setSaveOptimistic] = useOptimistic(
    { active: initialSavedByMe, count: initialSaveCount }, optimisticEngagement
  )
  const [mutationError, setMutationError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [isPendingLike, startLikeTransition] = useTransition()
  const [isPendingSave, startSaveTransition] = useTransition()

  const socialProof = useMemo(() => {
    if (likeCount > 0 && commentCount > 0) {
      return `${formatCompactNumber(likeCount)} likes · ${formatCompactNumber(commentCount)} comments`
    }

    if (likeCount > 0) {
      return `${formatCompactNumber(likeCount)} likes`
    }

    if (commentCount > 0) {
      return `${formatCompactNumber(commentCount)} comments`
    }

    return 'No engagement yet'
  }, [commentCount, likeCount])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {}
  }

  function handleToggleLike() {
    if (isPendingLike) return
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
    if (isPendingSave) return
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
    <section className="relative overflow-hidden rounded-[28px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.06),transparent_24%)]" />

      <div className="relative">
        {mutationError ? <p role="alert" className="mb-3 text-sm text-red-300">{mutationError}</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={isPendingLike}
            aria-pressed={likedByMe}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              likedByMe
                ? 'border-pink-400/20 bg-pink-500/12 text-white shadow-[0_14px_30px_rgba(236,72,153,0.12)]'
                : 'border-zinc-700 bg-black/70 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
            }`}
            aria-label={likedByMe ? 'Unlike post' : 'Like post'}
          >
            <Heart className="h-4 w-4" />
            {formatCompactNumber(likeCount)}
          </button>

          <Link
            href={commentsHref}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 bg-black/70 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {formatCompactNumber(commentCount)}
          </Link>

          <button
            type="button"
            onClick={handleToggleSave}
            disabled={isPendingSave}
            aria-pressed={savedByMe}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              savedByMe
                ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_14px_30px_rgba(120,119,255,0.12)]'
                : 'border-zinc-700 bg-black/70 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
            }`}
            aria-label={savedByMe ? 'Unsave post' : 'Save post'}
          >
            <Bookmark className="h-4 w-4" />
            {formatCompactNumber(saveCount)}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 bg-black/70 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
            aria-label="Copy post link"
          >
            <Share2 className="h-4 w-4" />
            {copyState === 'copied' ? 'Copied' : 'Share'}
          </button>

          {secondaryHref ? (
            <Link
              href={secondaryHref}
              aria-label={secondaryAriaLabel}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-4 py-2.5 text-sm font-semibold !text-black shadow-[0_14px_30px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:opacity-90 sm:col-span-1"
            >
              Open media
            </Link>
          ) : null}
        </div>

        <div className="mt-4 rounded-[22px] border border-zinc-800 bg-black/45 px-4 py-4">
          <p className="text-sm font-semibold text-white">{socialProof}</p>
          <Link
            href={commentsHref}
            className="mt-2 inline-block text-sm text-zinc-400 transition hover:text-white"
          >
            {commentsLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}