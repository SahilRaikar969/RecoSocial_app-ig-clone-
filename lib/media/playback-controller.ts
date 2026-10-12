export type PlaybackState = {
  ready: boolean
  playing: boolean
  buffering: boolean
  failed: boolean
  blocked: boolean
}

export const INITIAL_PLAYBACK_STATE: PlaybackState = {
  ready: false, playing: false, buffering: false, failed: false, blocked: false,
}

type Video = Pick<HTMLVideoElement, 'play' | 'pause' | 'load' | 'error' | 'readyState' | 'addEventListener' | 'removeEventListener'>
type Policy = { active: boolean; foreground: boolean; autoplay: boolean }

/** Owns one media element. Stale play promises cannot revive an inactive video. */
export function createPlaybackController(video: Video, onState: (state: PlaybackState) => void) {
  let state = { ...INITIAL_PLAYBACK_STATE, ready: video.readyState >= 2, failed: Boolean(video.error) }
  let policy: Policy = { active: false, foreground: true, autoplay: false }
  let intent: 'default' | 'play' | 'pause' = 'default'
  let generation = 0
  let disposed = false
  let requested = false

  const allowed = () => !disposed && policy.active && policy.foreground && !state.failed &&
    (intent === 'play' || (intent === 'default' && policy.autoplay))

  function publish(patch: Partial<PlaybackState>) {
    if (disposed) return
    state = { ...state, ...patch }
    onState(state)
  }

  function pause() {
    generation++
    requested = false
    video.pause()
    publish({ playing: false, buffering: false })
  }

  function play() {
    if (!allowed() || requested || state.playing) return
    requested = true
    const attempt = ++generation
    publish({ blocked: false, buffering: !state.ready })
    try {
      Promise.resolve(video.play()).then(() => {
        // A cancelled request may fulfill after pause or after the element is detached.
        // Do not pause a newer, permitted play request on the same element.
        if (!allowed()) video.pause()
        if (disposed || attempt !== generation) return
        requested = false
        publish({ playing: allowed(), buffering: false })
      }, () => {
        if (disposed || attempt !== generation) return
        requested = false
        publish({ playing: false, buffering: false, blocked: true })
      })
    } catch {
      requested = false
      publish({ playing: false, buffering: false, blocked: true })
    }
  }

  const listeners: Record<string, EventListener> = {
    loadeddata: () => publish({ ready: true, buffering: false }),
    canplay: () => publish({ ready: true, buffering: false }),
    playing: () => {
      if (!allowed()) { pause(); return }
      publish({ ready: true, playing: true, buffering: false, blocked: false })
    },
    pause: () => publish({ playing: false }),
    waiting: () => publish({ buffering: allowed() }),
    error: () => { pause(); publish({ failed: true, ready: false, blocked: false }) },
  }
  for (const [event, listener] of Object.entries(listeners)) video.addEventListener(event, listener)
  onState(state)

  return {
    setPolicy(next: Policy) {
      policy = next
      if (allowed()) play()
      else pause()
    },
    toggle() {
      if (state.failed || disposed) return
      if (state.playing || requested) { intent = 'pause'; pause() }
      else { intent = 'play'; play() }
    },
    retry() {
      if (disposed) return
      pause()
      intent = 'play'
      publish({ ...INITIAL_PLAYBACK_STATE })
      video.load()
      play()
    },
    dispose() {
      if (disposed) return
      disposed = true
      generation++
      for (const [event, listener] of Object.entries(listeners)) video.removeEventListener(event, listener)
      video.pause()
    },
  }
}
