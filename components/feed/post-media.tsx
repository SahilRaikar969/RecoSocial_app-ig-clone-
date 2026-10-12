/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { MediaSkeleton } from '@/components/ui/media-skeleton'
import { SmartImage } from '@/components/ui/smart-image'
import { useVideoPlayback } from '@/lib/media/use-video-playback'

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
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [isMuted, setIsMuted] = useState(true)
  const [visibleRatio, setVisibleRatio] = useState(0)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  const isVideo = mediaType === 'video'
  const feedLikeMode = useMemo(() => isFeedLikePath(pathname), [pathname])
  const { videoRef, playing: isActuallyPlaying, ready: isVideoLoaded, failed: hasMediaError, blocked, buffering, toggle, retry } = useVideoPlayback(isVideo ? mediaUrl : null, visibleRatio > 0, feedLikeMode && !isMobileViewport && visibleRatio >= 0.7, isMuted)

  useEffect(() => {
    function updateViewportMode() {
      setIsMobileViewport(window.innerWidth < 768)
    }

    updateViewportMode()
    window.addEventListener('resize', updateViewportMode)
    return () => window.removeEventListener('resize', updateViewportMode)
  }, [])

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

    if (typeof IntersectionObserver === 'undefined') { setVisibleRatio(1); return }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setVisibleRatio(entry.isIntersecting ? entry.intersectionRatio : 0)
      },
      {
        threshold: [0, 0.01, 0.3, 0.5, 0.7, 0.9],
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [isVideo, mediaUrl])

  function handleVideoClick() { toggle() }

  if (!mediaUrl) {
    return (
      <div
        ref={containerRef}
        className="relative flex aspect-[4/5] items-center justify-center bg-[#08080b] text-sm text-zinc-500"
      >
        <div className="rounded-full border border-zinc-800 bg-black px-4 py-1 text-sm font-medium text-zinc-400">
          Media unavailable
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="group relative overflow-hidden border-y border-zinc-800 bg-black"
    >
      {priorityLabel ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs font-medium text-white">
          {priorityLabel}
        </div>
      ) : null}

      {isVideo ? (
        <>

          <button
            type="button"
            onClick={handleVideoClick}
            className="relative block aspect-[4/5] w-full cursor-pointer bg-black"
            aria-label={isActuallyPlaying ? 'Pause video' : 'Play video'}
            disabled={hasMediaError}
          >
            {!isVideoLoaded && !hasMediaError ? <MediaSkeleton className="pointer-events-none absolute inset-0 aspect-[4/5] w-full" /> : null}
            <video
              ref={videoRef}
              key={mediaUrl}
              src={mediaUrl}
              poster={thumbnailUrl || undefined}
              playsInline
              loop
              muted
              preload="metadata"
              className={`aspect-[4/5] w-full bg-black object-contain transition duration-300 ${
                isVideoLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
          {hasMediaError ? <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
            <p role="status" className="text-sm text-zinc-300">This video could not be loaded. Its format or connection may be unavailable.</p>
            <button type="button" onClick={retry} className="min-h-11 rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white">Retry video</button>
          </div> : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/88 via-black/12 to-transparent px-4 pb-4 pt-16">
            <div className="flex items-end justify-between gap-3">
              <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-medium text-white">
                {blocked ? 'Tap to play' : buffering ? 'Loading video…' : isActuallyPlaying ? 'Playing' : 'Tap to play'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted((current) => !current)}
                  className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>

                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white">
                  {isActuallyPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <SmartImage
          src={mediaUrl}
          alt={alt}
          className="aspect-[4/5] w-full bg-black object-contain"
          fallbackClassName="flex aspect-[4/5] w-full items-center justify-center bg-[#08080b] text-sm text-zinc-500"
          fallbackText="Media unavailable"
          retryable
        />
      )}
    </div>
  )
}