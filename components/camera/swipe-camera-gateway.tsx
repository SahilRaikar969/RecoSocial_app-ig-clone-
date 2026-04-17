'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function isSwipeEnabledPath(pathname: string) {
  return pathname.startsWith('/feed') || pathname.startsWith('/create')
}

export function SwipeCameraGateway() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isSwipeEnabledPath(pathname)) return
    if (typeof window === 'undefined') return
    if (window.innerWidth >= 768) return

    let startX = 0
    let startY = 0
    let tracking = false
    let blocked = false

    function handleTouchStart(event: TouchEvent) {
      const target = event.target as HTMLElement | null

      blocked = Boolean(
        target?.closest(
          'button, a, input, textarea, select, form, video, [data-disable-camera-swipe="true"]'
        )
      )

      if (blocked) return

      const touch = event.touches[0]
      if (!touch) return

      startX = touch.clientX
      startY = touch.clientY
      tracking = startX <= 28
    }

    function handleTouchEnd(event: TouchEvent) {
      if (!tracking || blocked) {
        tracking = false
        blocked = false
        return
      }

      const touch = event.changedTouches[0]
      if (!touch) {
        tracking = false
        blocked = false
        return
      }

      const deltaX = touch.clientX - startX
      const deltaY = Math.abs(touch.clientY - startY)

      tracking = false
      blocked = false

      if (deltaX > 90 && deltaY < 60) {
        router.push(`/camera?returnTo=${encodeURIComponent(pathname)}`)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pathname, router])

  return null
}