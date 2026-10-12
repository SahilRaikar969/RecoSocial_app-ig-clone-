'use client'

import { useEffect, useRef, useState } from 'react'
import { createPlaybackController, INITIAL_PLAYBACK_STATE } from '@/lib/media/playback-controller'

/** The source is a dependency so a changed URL gets fresh readiness and user intent. */
export function useVideoPlayback(source: string | null | undefined, active: boolean, autoplay: boolean, muted: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState(INITIAL_PLAYBACK_STATE)
  const controllerRef = useRef<ReturnType<typeof createPlaybackController> | null>(null)
  const policyRef = useRef({ active, autoplay })

  useEffect(() => {
    policyRef.current = { active, autoplay }
    controllerRef.current?.setPolicy({ active, autoplay, foreground: document.visibilityState !== 'hidden' })
  }, [active, autoplay])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    const controller = createPlaybackController(element, setState)
    controllerRef.current = controller
    function syncVisibility() {
      controller.setPolicy({ ...policyRef.current, foreground: document.visibilityState !== 'hidden' })
    }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [source])

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted }, [source, muted])

  return {
    videoRef,
    ...state,
    toggle: () => controllerRef.current?.toggle(),
    retry: () => controllerRef.current?.retry(),
  }
}
