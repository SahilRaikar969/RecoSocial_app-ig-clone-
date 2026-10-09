'use client'

import { useUnreadCount } from '@/components/activity/unread-notifications-provider'

type ActivityNotificationDotProps = {
  className?: string
  mode?: 'dot' | 'count'
}

export function ActivityNotificationDot({
  className = '',
  mode = 'dot',
}: ActivityNotificationDotProps) {
  const unreadCount = useUnreadCount()

  if (unreadCount === 0) return null

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