'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { useActivitySync } from '@/components/activity/unread-notifications-provider'
import { markNotificationsRead } from '@/actions/notifications'

export function ActivityLive({ viewerId, children }: { viewerId: string; children: ReactNode }) {
  const { revision, viewerId: verifiedId } = useActivitySync()
  const last = useRef(revision)
  const router = useRouter()
  useEffect(() => {
    if (last.current === revision) return
    last.current = revision
    const timer = window.setTimeout(() => router.refresh(), 250)
    return () => window.clearTimeout(timer)
  }, [revision, router])
  if (verifiedId !== undefined && verifiedId !== viewerId) return <p role="status">Your session changed. Refresh Activity to continue.</p>
  return children
}

function MarkAllButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="rs-button">{pending ? 'Marking as read…' : 'Mark all as read'}</button>
}

export function MarkAllNotificationsRead() {
  return <form action={markNotificationsRead}><MarkAllButton /></form>
}
