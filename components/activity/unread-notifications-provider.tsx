'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { startUnreadMonitor } from '@/lib/notifications/unread-monitor'

const UnreadCountContext = createContext(0)

export function UnreadNotificationsProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    // Notifications are non-blocking; auth-only routes do not need this SDK.
    void import('@/lib/supabase/browser').then(({ createClient }) => {
      if (!disposed) stop = startUnreadMonitor(createClient(), setCount)
    }).catch(() => { /* Navigation stays usable if the optional chunk fails. */ })
    return () => { disposed = true; stop?.() }
  }, [])
  return <UnreadCountContext.Provider value={count}>{children}</UnreadCountContext.Provider>
}

export function useUnreadCount() {
  return useContext(UnreadCountContext)
}
