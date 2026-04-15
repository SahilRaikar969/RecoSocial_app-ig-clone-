'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { MediaSkeleton } from '@/components/ui/media-skeleton'
import { SmartImage } from '@/components/ui/smart-image'

type PostMediaProps = {
  mediaType: string
  mediaUrl: string | null
  thumbnailUrl?: string | null
  alt?: string
  priorityLabel?: string | null
}

const MUTE_STORAGE_KEY = 'recosocial_video_muted'

function isFeedLikePath(pathname: string) {
  return (
    pathname === '/feed' ||
    pathname === '/explore' ||
    pathname === '/saved' ||
    pathname.startsWith('/profile') ||
    pathname === '/activity'
  )
}

export function PostMedia({
  mediaType,
  mediaUrl,
  thumbnailUrl,
  alt = 'Post media',
  priorityLabel,
}: PostMediaProps) {
  const pathname = usePathname()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [isPausedByUser, setIsPausedByUser] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isInViewport, setIsInViewport] = useState(false)
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false)
  const [hasMediaError, setHasMediaError] = useState(false)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)

  const isVideo = mediaType === 'video'
  const feedLikeMode = useMemo(() => isFeedLikePath(pathname), [pathname])

  useEffect(() => {
    setHasMediaError(false)
    setIsPausedByUser(false)
    setIsActuallyPlaying(false)
    setIsVideoLoaded(false)
  }, [mediaUrl, thumbnailUrl, mediaType])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTE_STORAGE_KEY)
      if (stored === '0') {
        setIsMuted(false)
      } else {
        setIsMuted(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, isMuted ? '1' : '0')
    } catch {}
  }, [isMuted])

  useEffect(() => {
    if (!isVideo || !containerRef.current) return

    const node = containerRef.current

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.6)
      },
      {
        threshold: [0.2, 0.4, 0.6, 0.8],
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [isVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!isVideo || !video || hasMediaError) return

    if (!feedLikeMode) {
      video.pause()
      setIsActuallyPlaying(false)
      return
    }

    if (isInViewport && !isPausedByUser) {
      const playPromise = video.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsActuallyPlaying(true))
          .catch(() => setIsActuallyPlaying(false))
      }
    } else {
      video.pause()
      setIsActuallyPlaying(false)
    }
  }, [feedLikeMode, hasMediaError, isInViewport, isPausedByUser, isVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  function handleVideoClick() {
    const video = videoRef.current
    if (!video || hasMediaError) return

    if (video.paused) {
      setIsPausedByUser(false)
      const playPromise = video.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsActuallyPlaying(true))
          .catch(() => setIsActuallyPlaying(false))
      }
      return
    }

    setIsPausedByUser(true)
    video.pause()
    setIsActuallyPlaying(false)
  }

  if (!mediaUrl || hasMediaError) {
    return (
      <div
        ref={containerRef}
        className="relative flex aspect-[4/5] items-center justify-center bg-zinc-950 text-sm text-zinc-500"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,255,0.08),transparent_35%)]" />

        <div className="relative rounded-full border border-zinc-800 bg-black/80 px-4 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          Media unavailable
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="group relative overflow-hidden border-y border-zinc-900 bg-zinc-950"
    >
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(120,119,255,0.08),transparent_26%)]" />

      {priorityLabel ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
          {priorityLabel}
        </div>
      ) : null}

      {isVideo ? (
        <>
          {!isVideoLoaded ? (
            <MediaSkeleton className="aspect-[4/5] w-full" />
          ) : null}

          <button
            type="button"
            onClick={handleVideoClick}
            className="relative block w-full cursor-pointer bg-black"
            aria-label={isActuallyPlaying ? 'Pause video' : 'Play video'}
          >
            <video
              ref={videoRef}
              src={mediaUrl}
              poster={thumbnailUrl || undefined}
              playsInline
              loop
              muted
              preload="metadata"
              className={`aspect-[4/5] w-full bg-black object-cover transition duration-500 ${
                isVideoLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
              }`}
              onLoadedData={() => setIsVideoLoaded(true)}
              onCanPlay={() => setIsVideoLoaded(true)}
              onPlay={() => setIsActuallyPlaying(true)}
              onPause={() => setIsActuallyPlaying(false)}
              onError={() => {
                setHasMediaError(true)
                setIsActuallyPlaying(false)
              }}
            />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/10 to-transparent px-4 pb-4 pt-20">
            <div className="flex items-end justify-between gap-3">
              <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                {feedLikeMode
                  ? isActuallyPlaying
                    ? 'Playing'
                    : isPausedByUser
                      ? 'Paused'
                      : 'Ready'
                  : 'Video'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted((current) => !current)}
                  className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:scale-[1.03] hover:bg-black/75"
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>

                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                  {isActuallyPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <SmartImage
          src={mediaUrl}
          alt={alt}
          className="aspect-[4/5] w-full bg-black object-cover transition duration-500 group-hover:scale-[1.015]"
          fallbackClassName="flex aspect-[4/5] w-full items-center justify-center bg-zinc-950 text-sm text-zinc-500"
          fallbackText="Media unavailable"
        />
      )}
    </div>
  )
}