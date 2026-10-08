'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
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
    <section className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-black">
      {mutationError ? <p role="alert" className="absolute left-4 top-20 z-50 rounded bg-black/80 p-3 text-sm text-white">{mutationError}</p> : null}
      {hasPoster ? (
        <img
          src={reel.thumbnail_url!}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-black/50" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_24%)]" />

      <div className="relative h-[100svh] w-full max-w-[430px] overflow-hidden bg-black ring-1 ring-white/8">
        <button
          type="button"
          onClick={handleVideoToggle}
          className="absolute inset-0 z-0 block h-full w-full bg-black"
          aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
        >
          {hasPoster ? (
            <SmartImage
              src={reel.thumbnail_url}
              alt={reel.caption || 'Reel thumbnail'}
              className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${
                videoReady && !videoFailed ? 'opacity-0' : 'opacity-100'
              }`}
              fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-black text-sm text-zinc-500"
              fallbackText="Loading reel"
            />
          ) : null}

          {hasVideo && !videoFailed ? (
            <video
              ref={videoRef}
              src={reel.media_url!}
              poster={reel.thumbnail_url || undefined}
              playsInline
              loop
              muted
              preload={preload || active ? 'auto' : 'metadata'}
              className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${
                videoReady ? 'opacity-100' : 'opacity-0'
              }`}
              onLoadedData={() => setVideoReady(true)}
              onCanPlay={() => setVideoReady(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => {
                setVideoFailed(true)
                setIsPlaying(false)
              }}
            />
          ) : null}

          {unavailable || videoFailed ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 px-5 py-4 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Reel unavailable
                </div>
                <div className="mt-2 text-sm text-zinc-500">
                  Video source could not be loaded
                </div>
              </div>
            </div>
          ) : null}
        </button>

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/92 via-black/15 to-black/45" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-4">
          <Link
            href={backHref}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/65"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
              Reel {currentIndex}/{totalCount}
            </div>

            <Link
              href={buildPostDetailHref(reel.id)}
              className="pointer-events-auto rounded-full border border-white/10 bg-[linear-gradient(90deg,#ffffff_0%,#f4f4ff_100%)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black backdrop-blur transition hover:opacity-90"
            >
              Open post
            </Link>
          </div>
        </div>

        {showCenterIndicator && !videoFailed && !unavailable ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur">
              {isPlaying ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </div>
          </div>
        ) : null}

        {!videoFailed && !unavailable && !isPlaying && !showCenterIndicator ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur">
              <Play className="h-6 w-6" />
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between gap-4 px-4 pb-8 pt-24">
          <div className="min-w-0 max-w-[72%] text-white">
            <Link
              href={getProfileHref(reel.author?.id ?? reel.author_id, viewerProfileId)}
              className="pointer-events-auto inline-flex max-w-full items-center gap-3 rounded-2xl bg-black/35 px-3 py-2 backdrop-blur"
            >
              {reel.author?.avatar_url ? (
                <SmartImage
                  src={reel.author.avatar_url}
                  alt={reel.author.display_name || reel.author.username || 'Creator'}
                  className="h-10 w-10 rounded-full object-cover"
                  fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[10px] uppercase tracking-[0.16em] text-white"
                  fallbackText="U"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[10px] uppercase tracking-[0.16em] text-white">
                  U
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {reel.author?.username || 'creator'}
                </p>
                <p className="truncate text-xs text-zinc-300">
                  {reel.author?.display_name || 'Creator'}
                </p>
              </div>
            </Link>

            {reel.caption ? (
              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur">
                <p className="text-sm leading-7 text-zinc-100">{reel.caption}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
              <Link
                href={buildPostDetailHref(reel.id, true)}
                className="pointer-events-auto rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur transition hover:bg-black/55"
              >
                Comments
              </Link>
              <Link
                href={buildPostDetailHref(reel.id)}
                className="pointer-events-auto rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur transition hover:bg-black/55"
              >
                Details
              </Link>
            </div>
          </div>

          <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4">
            <button
              type="button"
              onClick={handleToggleLike}
            disabled={isPendingLike}
            aria-pressed={likedByMe}
              className={`flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur transition ${
                likedByMe
                  ? 'border-pink-400/20 bg-pink-500/14 text-white shadow-[0_12px_28px_rgba(236,72,153,0.14)]'
                  : 'border-white/10 bg-black/35 text-white hover:bg-black/55'
              }`}
              aria-label={likedByMe ? 'Unlike reel' : 'Like reel'}
            >
              <Heart className="h-5 w-5" />
            </button>
            <span className="text-xs font-medium text-white">
              {formatCompactNumber(likeCount)}
            </span>

            <Link
              href={buildPostDetailHref(reel.id, true)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
              aria-label="Open comments"
            >
              <MessageCircle className="h-5 w-5" />
            </Link>
            <span className="text-xs font-medium text-white">
              {formatCompactNumber(reel.comment_count)}
            </span>

            <button
              type="button"
              onClick={handleToggleSave}
            disabled={isPendingSave}
            aria-pressed={savedByMe}
              className={`flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur transition ${
                savedByMe
                  ? 'border-violet-400/20 bg-violet-500/14 text-white shadow-[0_12px_28px_rgba(120,119,255,0.14)]'
                  : 'border-white/10 bg-black/35 text-white hover:bg-black/55'
              }`}
              aria-label={savedByMe ? 'Remove save' : 'Save reel'}
            >
              <Bookmark className="h-5 w-5" />
            </button>
            <span className="text-xs font-medium text-white">
              {formatCompactNumber(saveCount)}
            </span>

            <button
              type="button"
              onClick={() => setIsMuted((current) => !current)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
              aria-label={isMuted ? 'Unmute reel' : 'Mute reel'}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {active && totalCount > 1 ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
              <ChevronDown className="h-3.5 w-3.5" />
              Scroll for more reels
            </div>
          </div>
        ) : null}
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
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    <div className="fixed inset-0 z-[100] bg-black text-white">
      <div
        ref={containerRef}
        className="h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-none"
        style={{ scrollBehavior: 'smooth' }}
      >
        {reels.map((reel, index) => (
          <div key={reel.id} data-post-id={reel.id} className="h-[100svh]">
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
    </div>
  )
}