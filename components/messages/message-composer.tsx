'use client'

import { useRef, useState } from 'react'
import { Send } from 'lucide-react'

export function MessageComposer({ onSend, pending }: { onSend: (body: string) => void; pending: boolean }) {
  const [body, setBody] = useState('')
  const submitted = useRef(false)
  return <form className="border-t border-white/10 bg-zinc-950 p-3" onSubmit={event => {
    event.preventDefault()
    const value = body.trim()
    if (!value || pending || submitted.current) return
    submitted.current = true
    onSend(value)
    setBody('')
    // Synchronous lock covers repeated submits before React commits pending UI.
    queueMicrotask(() => { submitted.current = false })
  }}>
    <label htmlFor="message-body" className="sr-only">Message</label>
    <div className="flex items-end gap-2 rounded-xl border border-white/10 p-2 focus-within:border-violet-400">
      <textarea id="message-body" name="body" value={body} onChange={event => setBody(event.target.value)} required rows={2} maxLength={1200} placeholder="Message…" className="max-h-32 min-h-12 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-base leading-6 text-white outline-none placeholder:text-zinc-500" />
      <button type="submit" disabled={pending || !body.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-400 text-black disabled:opacity-40" aria-label={pending ? 'Sending message' : 'Send message'}><Send className="h-4 w-4" /></button>
    </div>
  </form>
}
