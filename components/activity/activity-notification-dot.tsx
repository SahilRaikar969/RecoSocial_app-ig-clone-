'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

type ActivityNotificationDotProps = {
  className?: string
  mode?: 'dot' | 'count'
}

export function ActivityNotificationDot({
  className = '',
  mode = 'dot',
}: ActivityNotificationDotProps) {
  const [hasUnread, setHasUnread] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    async function loadUnreadCount() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!isMounted) return
        setHasUnread(false)
        setUnreadCount(0)
        return
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null)

      if (error) return
      if (!isMounted) return

      const safeCount = Number(count || 0)
      setUnreadCount(safeCount)
      setHasUnread(safeCount > 0)
    }

    void loadUnreadCount()

    const channel = supabase
      .channel('activity-unread-dot')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          void loadUnreadCount()
        }
      )
      .subscribe()

    const interval = window.setInterval(() => {
      void loadUnreadCount()
    }, 15000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [])

  if (!hasUnread) return null

  if (mode === 'count') {
    return (
      <span
        className={`inline-flex min-w-[20px] items-center justify-center rounded-full border border-pink-400/30 bg-pink-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_0_18px_rgba(236,72,153,0.45)] ${className}`}
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full bg-pink-500 shadow-[0_0_16px_rgba(236,72,153,0.9)] ${className}`}
    />
  )
}