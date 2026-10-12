'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SmartImage } from '@/components/ui/smart-image'
import { MessageComposer } from '@/components/messages/message-composer'
import { createClient } from '@/lib/supabase/browser'
import { startMessageMonitor } from '@/lib/messages/message-monitor'
import { mergeMessages, messageCursor, type ThreadMessage } from '@/lib/messages/message-state'
import { loadOlderMessages, markThreadRead, sendMessage } from '@/actions/message-delivery'

type MessageThreadProps = {
  viewerProfileId: string
  threadId: string
  otherProfile: { id: string; username: string; display_name: string; avatar_url?: string | null }
  messages: ThreadMessage[]
  hasOlder: boolean
  canSend: boolean
}

export function MessageThread({ viewerProfileId, threadId, otherProfile, messages: initial, hasOlder: initialHasOlder, canSend }: MessageThreadProps) {
  const router = useRouter()
  const [messages, setMessages] = useState(initial)
  const [hasOlder, setHasOlder] = useState(initialHasOlder)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [deliveryErrors, setDeliveryErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting')
  const [accountChanged, setAccountChanged] = useState(false)
  const [newMessages, setNewMessages] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const scroll = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const pending = useRef(new Set<string>())
  const alive = useRef(true)
  const readId = useRef('')
  const refreshing = useRef<(() => Promise<void>) | null>(null)
  const initialCursor = useRef(initial.length ? messageCursor(initial[initial.length - 1]) : undefined)
  const scrollToBottom = useCallback(() => {
    const node = scroll.current
    if (node) node.scrollTop = node.scrollHeight
    nearBottom.current = true
    setAtBottom(true)
    setNewMessages(false)
  }, [])

  useEffect(() => {
    alive.current = true
    const monitor = startMessageMonitor(createClient(), {
      viewerId: viewerProfileId, threadId, cursor: initialCursor.current,
      onMessages(incoming) {
        setMessages(current => mergeMessages(current, incoming, threadId))
        if (!nearBottom.current) setNewMessages(true)
      },
      onStatus: setStatus,
      onAccountChange() { alive.current = false; setAccountChanged(true); setMessages([]); setDeliveryErrors({}); router.refresh() },
    })
    refreshing.current = monitor.refresh
    return () => { alive.current = false; refreshing.current = null; monitor.stop() }
  }, [viewerProfileId, threadId, router])

  useEffect(() => { if (nearBottom.current) scrollToBottom() }, [messages, scrollToBottom])
  const latestConfirmed = [...messages].reverse().find(message => !message.delivery && message.sender_id !== viewerProfileId)
  useEffect(() => {
    const id = latestConfirmed?.id
    if (!id || !atBottom || accountChanged) return
    const mark = () => {
      if (document.visibilityState !== 'visible' || readId.current === id) return
      readId.current = id
      void markThreadRead(threadId, id).then(result => {
        if (!result.ok && readId.current === id) readId.current = ''
      }).catch(() => { if (readId.current === id) readId.current = '' })
    }
    mark()
    // A transient receipt failure is retried while the message stays visible.
    const retry = window.setInterval(mark, 15000)
    document.addEventListener('visibilitychange', mark)
    return () => { window.clearInterval(retry); document.removeEventListener('visibilitychange', mark) }
  }, [latestConfirmed?.id, atBottom, accountChanged, threadId])

  const deliver = async (message: ThreadMessage) => {
    if (pending.current.has(message.id) || !alive.current) return
    pending.current.add(message.id)
    setMessages(current => mergeMessages(current, [{ ...message, delivery: 'sending' }], threadId))
    setDeliveryErrors(current => { const next = { ...current }; delete next[message.id]; return next })
    try {
      const result = await sendMessage({ id: message.id, threadId, body: message.body })
      if (!alive.current) return
      if (result.message) {
        setMessages(current => mergeMessages(current, [result.message!], threadId))
        void refreshing.current?.()
      } else {
        setMessages(current => mergeMessages(current, [{ ...message, delivery: 'failed' }], threadId))
        setDeliveryErrors(current => ({ ...current, [message.id]: result.error || 'Could not confirm delivery.' }))
      }
    } catch {
      if (alive.current) {
        setMessages(current => mergeMessages(current, [{ ...message, delivery: 'failed' }], threadId))
        setDeliveryErrors(current => ({ ...current, [message.id]: 'Connection interrupted. Retry safely.' }))
      }
    } finally { pending.current.delete(message.id) }
  }
  const loadOlder = async () => {
    const first = messages.find(message => !message.delivery)
    if (!first || loadingOlder) return
    setLoadingOlder(true)
    setHistoryError('')
    const height = scroll.current?.scrollHeight ?? 0
    const top = scroll.current?.scrollTop ?? 0
    nearBottom.current = false
    setAtBottom(false)
    try {
      const result = await loadOlderMessages(threadId, messageCursor(first))
      if (!alive.current) return
      if (result.error) { setHistoryError(result.error); return }
      setMessages(current => mergeMessages(current, result.messages ?? [], threadId))
      setHasOlder(Boolean(result.hasOlder))
      requestAnimationFrame(() => { if (alive.current && scroll.current) scroll.current.scrollTop = top + scroll.current.scrollHeight - height })
    } catch { if (alive.current) setHistoryError('Older messages could not be loaded. Try again.') }
    finally { if (alive.current) setLoadingOlder(false) }
  }

  if (accountChanged) return <p role="status" className="p-6 text-sm text-zinc-400">Your session changed. Refresh Messages to continue.</p>
  return <section aria-label={`Conversation with ${otherProfile.username}`} className="min-w-0 bg-zinc-900">
    <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
      <SmartImage src={otherProfile.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" fallbackClassName="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-sm" fallbackText="?" />
      <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-semibold">{otherProfile.username}</h1><p className="truncate text-xs text-zinc-400">{otherProfile.display_name}</p></div>
      <p role="status" className="text-xs text-zinc-400">{status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</p>
    </header>
    <div ref={scroll} tabIndex={0} aria-label="Message history" className="h-[min(55dvh,38rem)] min-h-48 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400" onScroll={() => {
      const node = scroll.current
      if (!node) return
      const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 64
      nearBottom.current = bottom
      setAtBottom(bottom)
      if (bottom) setNewMessages(false)
    }}>
      {hasOlder ? <div className="text-center"><button type="button" className="rs-button" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? 'Loading…' : 'Load older messages'}</button></div> : null}
      {historyError ? <p role="alert" className="text-sm text-red-300">{historyError}</p> : null}
      {messages.map(message => {
        const own = message.sender_id === viewerProfileId
        return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`min-w-0 max-w-[88%] rounded-xl px-3 py-2 sm:max-w-[78%] ${own ? 'bg-violet-500/20 text-violet-50' : 'bg-white/[0.06] text-zinc-100'}`}>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>
          <p className="mt-1 text-right text-xs text-zinc-400"><time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>{message.delivery === 'sending' ? ' · Sending…' : message.delivery === 'failed' ? ' · Unconfirmed' : ''}</p>
          {message.delivery === 'failed' ? <div role="alert" className="mt-2 text-xs text-red-200"><p>{deliveryErrors[message.id]}</p><button type="button" onClick={() => void deliver(message)} className="rs-button mt-2">Retry message</button></div> : null}
        </div></div>
      })}
      {!messages.length ? <p className="py-12 text-center text-sm text-zinc-400">No messages yet. Start the conversation.</p> : null}
    </div>
    <div className="sr-only" role="status" aria-live="polite">{newMessages ? 'New messages. Use Jump to latest to read them.' : ''}</div>
    {newMessages ? <div className="px-3 pb-2 text-center"><button type="button" onClick={scrollToBottom} className="rs-button">Jump to latest</button></div> : null}
    {status === 'reconnecting' ? <p className="px-4 pb-3 text-xs text-zinc-400">Checking for messages every 15 seconds. <button type="button" className="underline" onClick={() => void refreshing.current?.()}>Reconnect now</button></p> : null}
    {canSend ? <MessageComposer pending={messages.some(message => message.delivery === 'sending')} onSend={body => {
      scrollToBottom()
      void deliver({ id: crypto.randomUUID(), thread_id: threadId, sender_id: viewerProfileId, body, created_at: new Date().toISOString(), delivery: 'sending' })
    }} /> : <p className="border-t border-white/10 p-4 text-sm text-zinc-400">Conversation history is available. You must follow each other to send new messages.</p>}
  </section>
}
