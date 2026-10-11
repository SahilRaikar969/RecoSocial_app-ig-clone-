'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bookmark,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import { toggleLikeInline } from '@/actions/likes'
import { toggleSaveInline } from '@/actions/saves'
import { optimisticEngagement } from '@/lib/mutations/optimistic-engagement'
import { SmartImage } from '@/components/ui/smart-image'

type ReelAuthor = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type ReelItem = {
  id: string
  author_id: string
  caption: string | null
  created_at: string
  media_url: string | null
  thumbnail_url: string | null
  like_count: number
  save_count: number
  comment_count: number
  liked_by_me: boolean
  saved_by_me: boolean
  author: ReelAuthor | null
}

type ReelViewerProps = {
  reels: ReelItem[]
  initialPostId: string
  viewerProfileId: string
  backHref: string
  viewerQueryString?: string
}

const MUTE_STORAGE_KEY = 'recosocial_reel_muted'

function getProfileHref(profileId?: string | null, viewerProfileId?: string) {
  const safeProfileId = String(profileId || '').trim()
  if (!safeProfileId) return '/profile'
  if (viewerProfileId && safeProfileId === viewerProfileId) return '/profile'
  return `/profile/${safeProfileId}`
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

function buildPostDetailHref(postId: string, focusComments = false) {
  return focusComments ? `/post/${postId}#comments` : `/post/${postId}`
}

function ReelCard({
  reel,
  viewerProfileId,
  active,
  backHref,
  preload,
  currentIndex,
  totalCount,
}: {
  reel: ReelItem
  viewerProfileId: string
  active: boolean
  backHref: string
  preload: boolean
  currentIndex: number
  totalCount: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const router = useRouter()
  const [{ active: likedByMe, count: likeCount }, setLikeOptimistic] = useOptimistic(
    { active: reel.liked_by_me, count: reel.like_count }, optimisticEngagement
  )
  const [{ active: savedByMe, count: saveCount }, setSaveOptimistic] = useOptimistic(
    { active: reel.saved_by_me, count: reel.save_count }, optimisticEngagement
  )
  const [mutationError, setMutationError] = useState('')
  const [isMuted, setIsMuted] = useState(true)
  const [isPausedByUser, setIsPausedByUser] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [showCenterIndicator, setShowCenterIndicator] = useState(false)
  const [isPendingLike, startLikeTransition] = useTransition()
  const [isPendingSave, startSaveTransition] = useTransition()

  const indicatorTimerRef = useRef<number | null>(null)

  const hasVideo = Boolean(reel.media_url)
  const hasPoster = Boolean(reel.thumbnail_url)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTE_STORAGE_KEY)
      setIsMuted(stored !== '0')
    } catch {
      setIsMuted(true)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, isMuted ? '1' : '0')
    } catch {}
  }, [isMuted])

  useEffect(() => {
    setVideoReady(false)
    setVideoFailed(false)
    setIsPausedByUser(false)
    setIsPlaying(false)
    setShowCenterIndicator(false)
  }, [reel.id, reel.media_url, reel.thumbnail_url])

  useEffect(() => {
    return () => {
      if (indicatorTimerRef.current) {
        window.clearTimeout(indicatorTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasVideo || videoFailed) return

    if (active && videoReady && !isPausedByUser) {
      const playPromise = video.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      }
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [active, videoReady, isPausedByUser, videoFailed, hasVideo])

  function pulseCenterIndicator() {
    setShowCenterIndicator(true)

    if (indicatorTimerRef.current) {
      window.clearTimeout(indicatorTimerRef.current)
    }

    indicatorTimerRef.current = window.setTimeout(() => {
      setShowCenterIndicator(false)
    }, 620)
  }

  function handleVideoToggle() {
    const video = videoRef.current
    if (!video || !hasVideo || videoFailed) return

    if (video.paused) {
      setIsPausedByUser(false)
      const playPromise = video.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            setIsPlaying(true)
            pulseCenterIndicator()
          })
          .catch(() => setIsPlaying(false))
      }
      return
    }

    setIsPausedByUser(true)
    video.pause()
    setIsPlaying(false)
    pulseCenterIndicator()
  }

  function handleToggleLike() {
    if (isPendingLike) return
    const previous = likedByMe
    setMutationError('')
    startLikeTransition(async () => {
      setLikeOptimistic(!previous)
      try {
        const result = await toggleLikeInline({
          postId: reel.id,
          devProfileId: viewerProfileId,
          liked: previous,
          returnTo: `/reel/${reel.id}`,
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
          postId: reel.id,
          devProfileId: viewerProfileId,
          saved: previous,
          returnTo: `/reel/${reel.id}`,
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

  const unavailable = !hasVideo && !hasPoster

  return (
    <section className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-black" inert={!active} aria-label={'Reel ' + currentIndex + ' of ' + totalCount}>
      {mutationError ? <p role="alert" className="absolute left-4 right-4 top-20 z-50 rounded-lg bg-black/90 p-3 text-sm text-white">{mutationError}</p> : null}
      <div className="relative h-[100svh] w-full max-w-[480px] overflow-hidden bg-black">
        <button type="button" onClick={handleVideoToggle}
          className="absolute inset-0 z-0 block h-full w-full bg-black focus-visible:outline-offset-[-4px]"
          aria-label={isPlaying ? 'Pause reel' : 'Play reel'} disabled={unavailable || videoFailed}>
          {hasPoster ? <SmartImage src={reel.thumbnail_url} alt={reel.caption || 'Reel thumbnail'}
            loading={active ? 'eager' : 'lazy'} fetchPriority={active ? 'high' : 'low'}
            className={'absolute inset-0 h-full w-full object-cover ' + (videoReady && !videoFailed ? 'opacity-0' : 'opacity-100')}
            fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-black text-sm text-zinc-400" fallbackText="Loading reel" /> : null}
          {hasVideo && !videoFailed ? <video ref={videoRef} src={reel.media_url!} poster={reel.thumbnail_url || undefined}
            playsInline loop muted preload={active ? 'auto' : preload ? 'metadata' : 'none'}
            className={'absolute inset-0 h-full w-full object-contain ' + (videoReady ? 'opacity-100' : 'opacity-0')}
            onLoadedData={() => setVideoReady(true)} onCanPlay={() => setVideoReady(true)}
            onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
            onError={() => { setVideoFailed(true); setIsPlaying(false) }} /> : null}
          {unavailable || videoFailed ? <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 px-8">
            <div className="text-center"><p className="text-base font-semibold text-white">Reel unavailable</p><p className="mt-2 text-sm text-zinc-400">This video could not be loaded.</p></div>
          </div> : null}
        </button>
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-transparent to-black/50" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 pt-[max(12px,env(safe-area-inset-top))]">
          <Link href={backHref} className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-lg bg-black/65 px-3 text-sm font-medium text-white hover:bg-black/85"><ArrowLeft className="h-4 w-4" />Back</Link>
          <p className="text-sm font-medium text-white">Reels <span className="text-zinc-300">{currentIndex}/{totalCount}</span></p>
          <Link href={buildPostDetailHref(reel.id)} className="pointer-events-auto inline-flex min-h-11 items-center rounded-lg bg-black/65 px-3 text-sm font-medium text-white hover:bg-black/85">Open post</Link>
        </div>
        {!videoFailed && !unavailable && (showCenterIndicator || !isPlaying) ? <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden="true">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/65 text-white">{isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}</div>
        </div> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-16">
          <div className="min-w-0 flex-1 text-white">
            <Link href={getProfileHref(reel.author?.id ?? reel.author_id, viewerProfileId)} className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-lg bg-black/50 px-2 py-2">
              <SmartImage src={reel.author?.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover"
                fallbackClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm text-white"
                fallbackText={(reel.author?.username || 'U').slice(0, 1).toUpperCase()} />
              <span className="truncate text-sm font-semibold">{reel.author?.username || 'Creator'}</span>
            </Link>
            {reel.caption ? <p className="mt-3 line-clamp-4 break-words text-sm leading-6 text-white">{reel.caption}</p> : null}
            <Link href={buildPostDetailHref(reel.id)} className="pointer-events-auto mt-1 inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4 hover:text-white">View post details</Link>
          </div>
          <div className="pointer-events-auto flex w-12 shrink-0 flex-col items-center gap-3 text-white">
            <div className="text-center"><button type="button" onClick={handleToggleLike} disabled={isPendingLike} aria-pressed={likedByMe}
              aria-label={likedByMe ? 'Unlike reel' : 'Like reel'}
              className={'flex h-11 w-11 items-center justify-center rounded-full bg-black/65 hover:bg-black/85 disabled:opacity-60 ' + (likedByMe ? 'text-violet-300' : 'text-white')}><Heart className={'h-6 w-6 ' + (likedByMe ? 'fill-current' : '')} /></button>
              <span className="mt-1 block text-xs"><span className="sr-only">Likes: </span>{formatCompactNumber(likeCount)}</span></div>
            <div className="text-center"><Link href={buildPostDetailHref(reel.id, true)} aria-label="Open comments" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 hover:bg-black/85"><MessageCircle className="h-6 w-6" /></Link>
              <span className="mt-1 block text-xs"><span className="sr-only">Comments: </span>{formatCompactNumber(reel.comment_count)}</span></div>
            <div className="text-center"><button type="button" onClick={handleToggleSave} disabled={isPendingSave} aria-pressed={savedByMe}
              aria-label={savedByMe ? 'Remove save' : 'Save reel'}
              className={'flex h-11 w-11 items-center justify-center rounded-full bg-black/65 hover:bg-black/85 disabled:opacity-60 ' + (savedByMe ? 'text-violet-300' : 'text-white')}><Bookmark className={'h-6 w-6 ' + (savedByMe ? 'fill-current' : '')} /></button>
              <span className="mt-1 block text-xs"><span className="sr-only">Saves: </span>{formatCompactNumber(saveCount)}</span></div>
            <button type="button" onClick={() => setIsMuted(current => !current)} aria-label={isMuted ? 'Unmute reel' : 'Mute reel'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 hover:bg-black/85">{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ReelViewer({
  reels,
  initialPostId,
  viewerProfileId,
  backHref,
  viewerQueryString = '',
}: ReelViewerProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [activeId, setActiveId] = useState(initialPostId)
  const lockRef = useRef(false)
  const touchStartYRef = useRef<number | null>(null)

  const startIndex = useMemo(() => {
    const foundIndex = reels.findIndex((item) => item.id === initialPostId)
    return foundIndex >= 0 ? foundIndex : 0
  }, [initialPostId, reels])

  const activeIndex = useMemo(() => {
    const foundIndex = reels.findIndex((item) => item.id === activeId)
    return foundIndex >= 0 ? foundIndex : 0
  }, [activeId, reels])

  function scrollToIndex(nextIndex: number) {
    const container = containerRef.current
    if (!container) return

    const boundedIndex = Math.max(0, Math.min(reels.length - 1, nextIndex))
    const target = container.children.item(boundedIndex) as HTMLElement | null
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const target = container.children.item(startIndex) as HTMLElement | null
    if (!target) return

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' })
    })
  }, [startIndex])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const slides = Array.from(container.children) as HTMLElement[]

    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (best && best.intersectionRatio >= 0.72) {
          const postId = best.target.getAttribute('data-post-id')
          if (postId) {
            setActiveId(postId)
          }
        }
      },
      {
        threshold: [0.55, 0.72, 0.9],
      }
    )

    slides.forEach((slide) => observer.observe(slide))

    return () => observer.disconnect()
  }, [reels])

  useEffect(() => {
    const nextUrl = viewerQueryString
      ? `/reel/${activeId}?${viewerQueryString}`
      : `/reel/${activeId}`

    window.history.replaceState(null, '', nextUrl)
  }, [activeId, viewerQueryString])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent) => {
      if (lockRef.current) {
        event.preventDefault()
        return
      }

      const absDelta = Math.abs(event.deltaY)
      if (absDelta < 18) return

      event.preventDefault()

      const direction = event.deltaY > 0 ? 1 : -1
      const nextIndex = Math.max(0, Math.min(reels.length - 1, activeIndex + direction))

      if (nextIndex === activeIndex) return

      lockRef.current = true
      scrollToIndex(nextIndex)

      window.setTimeout(() => {
        lockRef.current = false
      }, 420)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [activeIndex, reels.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (lockRef.current) return

      const startY = touchStartYRef.current
      const endY = event.changedTouches[0]?.clientY ?? null

      if (startY == null || endY == null) return

      const delta = startY - endY
      if (Math.abs(delta) < 42) return

      const direction = delta > 0 ? 1 : -1
      const nextIndex = Math.max(0, Math.min(reels.length - 1, activeIndex + direction))

      if (nextIndex === activeIndex) return

      lockRef.current = true
      scrollToIndex(nextIndex)

      window.setTimeout(() => {
        lockRef.current = false
      }, 420)
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [activeIndex, reels.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)))) return
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key.toLowerCase() === 'j') {
        event.preventDefault()
        scrollToIndex(activeIndex + 1)
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key.toLowerCase() === 'k') {
        event.preventDefault()
        scrollToIndex(activeIndex - 1)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        router.push(backHref)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeIndex, backHref, router])

  return (
    <main className="fixed inset-0 z-[100] bg-black text-white" aria-label="Reels">
      <div
        ref={containerRef}
        className="h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-none"
        aria-label="Reels. Use up and down arrows to browse."
      >
        {reels.map((reel, index) => (
          <div key={reel.id} data-post-id={reel.id} className="h-[100svh] snap-start">
            <ReelCard
              reel={reel}
              viewerProfileId={viewerProfileId}
              active={activeId === reel.id}
              backHref={backHref}
              preload={Math.abs(index - activeIndex) <= 1}
              currentIndex={index + 1}
              totalCount={reels.length}
            />
          </div>
        ))}
      </div>
    </main>
  )
}