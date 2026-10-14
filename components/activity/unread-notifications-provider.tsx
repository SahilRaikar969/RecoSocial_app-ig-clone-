'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { startUnreadMonitor } from '@/lib/notifications/unread-monitor'

const UnreadCountContext = createContext(0)
const ActivitySyncContext = createContext<{ revision: number; viewerId: string | null | undefined }>({ revision: 0, viewerId: undefined })

export function UnreadNotificationsProvider({ children, initialViewerId }: { children: ReactNode; initialViewerId: string | null }) {
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined)
  const [sessionChanged, setSessionChanged] = useState(false)
  // Keep the identity that produced this document, including on the first
  // browser check. A later RSC update must not rebind existing private state.
  const [mountedViewer] = useState(initialViewerId)
  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    // Notifications are non-blocking; auth-only routes do not need this SDK.
    void import('@/lib/supabase/browser').then(({ createClient }) => {
      if (!disposed) stop = startUnreadMonitor(createClient(), setCount, {
        onSync: () => setRevision(value => value + 1),
        onViewer: setViewerId,
        onVerifiedViewer: nextViewer => {
          if (nextViewer !== mountedViewer) setSessionChanged(true)
        },
      })
    }).catch(() => { /* Navigation stays usable if the optional chunk fails. */ })
    return () => { disposed = true; stop?.() }
  }, [mountedViewer])
  useEffect(() => {
    // refresh() preserves Client Component state. Replace the document so no
    // previous viewer's drafts, private payloads or Router Cache entries survive.
    if (sessionChanged) window.location.reload()
  }, [sessionChanged])
  if (sessionChanged) return <main role="status" className="p-6 text-sm text-white/70">Updating your session…</main>
  return <UnreadCountContext.Provider value={count}><ActivitySyncContext.Provider value={{ revision, viewerId }}>{children}</ActivitySyncContext.Provider></UnreadCountContext.Provider>
}

export function useUnreadCount() {
  return useContext(UnreadCountContext)
}

export function useActivitySync() { return useContext(ActivitySyncContext) }
