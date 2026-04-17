'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { markStoryViewed } from '@/actions/stories'
import { SmartImage } from '@/components/ui/smart-image'

type StoryViewerProps = {
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
  }
  stories: Array<{
    id: string
    media_type: string
    media_url?: string | null
    thumbnail_url?: string | null
    caption?: string
    created_at: string
    expires_at: string
    viewed?: boolean
  }>
  initialIndex: number
}

export function StoryViewer({
  author,
  stories,
  initialIndex,
}: StoryViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const currentStory = stories[index]

  useEffect(() => {
    if (!currentStory?.id) return
    void markStoryViewed(currentStory.id)
  }, [currentStory?.id])

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.muted = muted
  }, [muted, currentStory?.id])

  const previousStoryId = useMemo(
    () => (index > 0 ? stories[index - 1]?.id : null),
    [index, stories]
  )

  const nextStoryId = useMemo(
    () => (index < stories.length - 1 ? stories[index + 1]?.id : null),
    [index, stories]
  )

  function goPrevious() {
    if (index > 0) setIndex((current) => current - 1)
  }

  function goNext() {
    if (index < stories.length - 1) setIndex((current) => current + 1)
  }

  if (!currentStory) {
    return null
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[520px] items-center justify-center px-4 py-6">
        <div className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 px-4 pt-4">
            {stories.map((story, storyIndex) => (
              <div
                key={story.id}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className={`h-full rounded-full ${
                    storyIndex < index
                      ? 'w-full bg-white'
                      : storyIndex === index
                        ? 'w-full bg-pink-400'
                        : 'w-0 bg-transparent'
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-7">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/feed"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white transition hover:bg-black/75"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{author.username}</p>
                <p className="truncate text-xs text-zinc-300">{author.display_name}</p>
              </div>
            </div>

            {currentStory.media_type === 'video' ? (
              <button
                type="button"
                onClick={() => setMuted((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white transition hover:bg-black/75"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}
          </div>

          <div className="relative aspect-[9/16] bg-black">
            {currentStory.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={currentStory.media_url || undefined}
                poster={currentStory.thumbnail_url || undefined}
                className="h-full w-full object-cover"
                controls
                playsInline
                autoPlay
                loop
                muted
              />
            ) : (
              <SmartImage
                src={currentStory.media_url}
                alt={currentStory.caption || 'Story'}
                className="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center bg-zinc-950 text-sm text-zinc-500"
                fallbackText="Story unavailable"
              />
            )}

            <button
              type="button"
              onClick={goPrevious}
              disabled={!previousStoryId}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/55 p-2 text-white transition hover:bg-black/75 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!nextStoryId}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/55 p-2 text-white transition hover:bg-black/75 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {currentStory.caption ? (
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/92 via-black/20 to-transparent px-5 pb-5 pt-24">
                <p className="rounded-[22px] border border-white/10 bg-black/35 px-4 py-3 text-sm leading-7 text-zinc-100">
                  {currentStory.caption}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}