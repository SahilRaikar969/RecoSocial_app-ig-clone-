'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { startMessageMonitor } from '@/lib/messages/message-monitor'

export function MessagesLive({ viewerId, children }: { viewerId: string; children: ReactNode }) {
  const router = useRouter()
  const [changed, setChanged] = useState(false)
  const [status, setStatus] = useState('connecting')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const monitor = startMessageMonitor(createClient(), {
      viewerId,
      onInbox() {
        // Bursts of events update the inbox once, using its authoritative RPC.
        if (timer) return
        timer = setTimeout(() => { timer = undefined; router.refresh() }, 500)
      },
      onStatus: setStatus,
      onAccountChange() { setChanged(true); router.refresh() },
    })
    return () => { monitor.stop(); if (timer) clearTimeout(timer) }
  }, [viewerId, router])
  if (changed) return <p role="status">Your session changed. Refresh Messages to continue.</p>
  return <><p role="status" className="text-xs text-zinc-400">{status === 'connected' ? 'Messages update live.' : status === 'reconnecting' ? 'Reconnecting. Checking for messages every 15 seconds.' : 'Connecting to messages…'}</p>{children}</>
}
