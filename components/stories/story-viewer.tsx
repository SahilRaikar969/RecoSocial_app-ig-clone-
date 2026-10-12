'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { markStoryViewed } from '@/actions/stories'
import { advanceStoryTime, IMAGE_STORY_MS, isStoryExpired, storyDestination } from '@/components/stories/story-timeline'

const serverFalse = () => false
const hiddenSnapshot = () => document.hidden
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
const reducedSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const subscribeReducedMotion = (notify: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

type Story = {
  id: string
  media_type: string
  media_url?: string | null
  thumbnail_url?: string | null
  caption?: string
  created_at: string
  expires_at: string
  viewed?: boolean
}

type StoryViewerProps = {
  author: { id: string; username: string; display_name: string; avatar_url?: string | null }
  stories: Story[]
  initialIndex: number
  viewerProfileId?: string | null
  previousAuthorStoryId?: string | null
  nextAuthorStoryId?: string | null
}

/** Mounted per source/retry: readiness, failures, playback, and time cannot leak to another story. */
function StoryMedia({ story, paused, muted, onProgress, onComplete, onReady, onPlaybackBlocked }: {
  story: Story; paused: boolean; muted: boolean
  onProgress: (value: number) => void; onComplete: () => void; onReady: () => void; onPlaybackBlocked: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const playbackAllowed = useRef(false)
  const elapsed = useRef(0)
  const finished = useRef(false)
  const complete = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (status !== 'loading') return
    const timer = window.setTimeout(() => setStatus('failed'), 20000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let active = true
    playbackAllowed.current = !paused && status === 'ready'
    if (!playbackAllowed.current) video.pause()
    else void video.play().then(() => {
      // A pending play may settle after backgrounding, pause, or unmount.
      // Do not stop a newer permitted request on this same media element.
      if (!playbackAllowed.current || document.hidden) { video.pause(); return }
      if (active) onReady()
    }, () => { if (active) onPlaybackBlocked() })
    return () => { active = false; playbackAllowed.current = false; video.pause() }
  }, [paused, status, onPlaybackBlocked, onReady])

  useEffect(() => {
    if (status !== 'ready' || paused) return
    if (story.media_type === 'video') return
    onReady()
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      elapsed.current = advanceStoryTime(elapsed.current, now - previous, IMAGE_STORY_MS, document.hidden)
      previous = now
      onProgress(elapsed.current / IMAGE_STORY_MS)
      if (elapsed.current >= IMAGE_STORY_MS) complete()
    }, 100)
    return () => window.clearInterval(timer)
  }, [status, paused, story.media_type, complete, onProgress, onReady])

  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (!video) return
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  if (status === 'failed' || !story.media_url) return <div role="alert" className="flex h-full items-center justify-center px-16 text-center text-sm text-zinc-300">Story unavailable. Retry or continue to the next story.</div>

  return <>
    {status === 'loading' ? <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950"><Loader2 aria-hidden="true" className="h-6 w-6 motion-safe:animate-spin" /><span className="sr-only">Loading story</span></div> : null}
    {story.media_type === 'video' ? <video
      ref={videoRef}
      src={story.media_url}
      poster={story.thumbnail_url || undefined}
      className="h-full w-full object-contain"
      playsInline
      muted={muted}
      preload="auto"
      aria-label={story.caption || 'Story video'}
      onLoadedData={() => setStatus('ready')}
      onWaiting={() => setStatus('loading')}
      onPlaying={event => {
        if (paused || document.hidden) { event.currentTarget.pause(); return }
        setStatus('ready')
      }}
      onCanPlay={() => setStatus('ready')}
      onTimeUpdate={event => {
        const video = event.currentTarget
        if (Number.isFinite(video.duration) && video.duration > 0) onProgress(video.currentTime / video.duration)
      }}
      onEnded={complete}
      onError={() => setStatus('failed')}
    /> : (
      // eslint-disable-next-line @next/next/no-img-element -- Native load/error events drive the story clock for arbitrary uploaded media.
      <img
      src={story.media_url}
      alt={story.caption || 'Story by this creator'}
      className="h-full w-full object-contain"
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setStatus('ready')}
      onError={() => setStatus('failed')}
    />)}
  </>
}

export function StoryViewer({ author, stories, initialIndex, viewerProfileId = null, previousAuthorStoryId = null, nextAuthorStoryId = null }: StoryViewerProps) {
  const router = useRouter()
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, stories.length - 1)))
  const [muted, setMuted] = useState(true)
  const [pauseOverride, setPaused] = useState<boolean | null>(null)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedSnapshot, serverFalse)
  const hidden = useSyncExternalStore(subscribeVisibility, hiddenSnapshot, serverFalse)
  const paused = pauseOverride ?? reducedMotion
  const [progress, setProgress] = useState(0)
  const [retry, setRetry] = useState(0)
  const [viewError, setViewError] = useState('')
  const seen = useRef(new Set(stories.filter(story => story.viewed).map(story => story.id)))
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const currentStory = stories[index]

  const close = useCallback(() => { router.push('/feed'); router.refresh() }, [router])
  const navigate = useCallback((direction: 'next' | 'previous') => {
    const destination = storyDestination(index, stories.length, direction, direction === 'next' ? nextAuthorStoryId : previousAuthorStoryId)
    if (destination.index !== null) {
      setIndex(destination.index)
      setProgress(0)
      setRetry(0)
      setViewError('')
    } else if (destination.href === '/feed') close()
    else if (destination.href) router.push(destination.href)
  }, [index, stories.length, previousAuthorStoryId, nextAuthorStoryId, close, router])
  const complete = useCallback(() => navigate('next'), [navigate])
  const playbackBlocked = useCallback(() => setPaused(true), [])

  useEffect(() => {
    mainRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!currentStory?.expires_at) return
    const expiration = Date.parse(currentStory.expires_at)
    if (!Number.isFinite(expiration)) return
    const timer = window.setTimeout(complete, Math.max(0, expiration - Date.now()))
    return () => window.clearTimeout(timer)
  }, [currentStory?.id, currentStory?.expires_at, complete])

  const recordView = useCallback(() => {
    const storyId = currentStory?.id
    if (!viewerProfileId || !storyId || document.hidden || seen.current.has(storyId)) return
    seen.current.add(storyId)
    void markStoryViewed(storyId).then(result => {
      if (!result.ok) { seen.current.delete(storyId); setViewError('Your viewed status could not be saved.') }
    }).catch(() => { seen.current.delete(storyId); setViewError('Your viewed status could not be saved.') })
  }, [currentStory?.id, viewerProfileId])

  if (!currentStory) return <main className="rs-page"><p>No active stories.</p><Link href="/feed">Back to feed</Link></main>
  const expired = isStoryExpired(currentStory.expires_at)

  return <main ref={mainRef} tabIndex={-1} aria-label={author.username + ' stories'} className="relative min-h-[100svh] overflow-hidden bg-black text-white outline-none"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if ((event.target as HTMLElement).closest('input, textarea, select')) return
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate('next') }
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate('previous') }
      if (event.key === ' ' && !(event.target as HTMLElement).closest('button, a, video')) { event.preventDefault(); setPaused(!paused) }
    }}>
    <div className="relative mx-auto flex min-h-[100svh] max-w-[520px] items-center justify-center sm:px-4 sm:py-4">
      <div className="relative w-full overflow-hidden bg-black sm:rounded-xl sm:border sm:border-zinc-800">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 px-4 pt-4" aria-label="Story progress">
          {stories.map((story, storyIndex) => <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20" role={storyIndex === index ? 'progressbar' : undefined} aria-label={storyIndex === index ? 'Current story progress' : undefined} aria-valuemin={storyIndex === index ? 0 : undefined} aria-valuemax={storyIndex === index ? 100 : undefined} aria-valuenow={storyIndex === index ? Math.round(progress * 100) : undefined}>
            <div className="h-full rounded-full bg-white" style={{ width: (storyIndex < index ? 100 : storyIndex === index ? progress * 100 : 0) + '%' }} />
          </div>)}
        </div>
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(28px,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/feed" aria-label="Back to feed" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/65"><ArrowLeft className="h-4 w-4" /></Link>
            <Link href={'/profile/' + author.id} className="min-w-0 rounded-lg bg-black/60 px-2 py-1"><p className="truncate text-sm font-semibold">{author.username}</p><p className="truncate text-xs text-zinc-300">{index + 1} of {stories.length}</p></Link>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume story' : 'Pause story'} aria-pressed={paused} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/65">{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
            {currentStory.media_type === 'video' ? <button type="button" onClick={() => setMuted(value => !value)} aria-label={muted ? 'Unmute story' : 'Mute story'} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/65">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button> : null}
          </div>
        </div>
        <p className="sr-only" role="status">{author.username}, story {index + 1} of {stories.length}{paused ? ', paused' : ''}</p>
        <div className="relative h-[100svh] bg-black sm:aspect-[9/16] sm:h-auto sm:max-h-[calc(100svh-32px)]"
          onTouchStart={event => {
            if ((event.target as HTMLElement).closest('button, a, video')) return
            const touch = event.touches[0]
            if (touch && event.touches.length === 1) touchStart.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchCancel={() => { touchStart.current = null }}
          onTouchEnd={event => {
            const start = touchStart.current, end = event.changedTouches[0]
            touchStart.current = null
            if (!start || !end || Math.abs(start.y - end.clientY) > 70) return
            if (Math.abs(start.x - end.clientX) > 60) navigate(start.x > end.clientX ? 'next' : 'previous')
          }}>
          {expired ? <p className="flex h-full items-center justify-center">This story has expired.</p> : <StoryMedia key={currentStory.id + ':' + retry} story={currentStory} paused={paused || hidden} muted={muted} onProgress={setProgress} onComplete={complete} onReady={recordView} onPlaybackBlocked={playbackBlocked} />}
          <button type="button" onClick={() => navigate('previous')} aria-label="Previous story" disabled={index === 0 && !previousAuthorStoryId} className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/65 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={complete} aria-label="Next story" className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/65"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/30 to-transparent px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-16">
            {currentStory.caption ? <p className="max-h-32 overflow-y-auto rounded-lg bg-black/65 px-3 py-2 text-sm leading-6">{currentStory.caption}</p> : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-400">{currentStory.media_type === 'image' ? '6 seconds · pause to read' : 'Advances when video ends'}</span>
              <button type="button" onClick={() => { setRetry(value => value + 1); setProgress(0); setViewError('') }} className="min-h-11 shrink-0 rounded-lg bg-black/65 px-3 text-xs text-zinc-200">Retry media</button>
            </div>
            {viewError ? <p role="status" className="text-xs text-zinc-300">{viewError}</p> : null}
          </div>
        </div>
      </div>
    </div>
  </main>
}
