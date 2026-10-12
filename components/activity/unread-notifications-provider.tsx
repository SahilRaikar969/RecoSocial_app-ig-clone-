'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { startUnreadMonitor } from '@/lib/notifications/unread-monitor'

const UnreadCountContext = createContext(0)
const ActivitySyncContext = createContext<{ revision: number; viewerId: string | null | undefined }>({ revision: 0, viewerId: undefined })

export function UnreadNotificationsProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    // Notifications are non-blocking; auth-only routes do not need this SDK.
    void import('@/lib/supabase/browser').then(({ createClient }) => {
      if (!disposed) stop = startUnreadMonitor(createClient(), setCount, { onSync: () => setRevision(value => value + 1), onViewer: setViewerId })
    }).catch(() => { /* Navigation stays usable if the optional chunk fails. */ })
    return () => { disposed = true; stop?.() }
  }, [])
  return <UnreadCountContext.Provider value={count}><ActivitySyncContext.Provider value={{ revision, viewerId }}>{children}</ActivitySyncContext.Provider></UnreadCountContext.Provider>
}

export function useUnreadCount() {
  return useContext(UnreadCountContext)
}

export function useActivitySync() { return useContext(ActivitySyncContext) }
