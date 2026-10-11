'use client'

import { useState } from 'react'

export function CopyPostLinkButton({ postId }: { postId: string }) {
  const [message, setMessage] = useState('')
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/post/' + encodeURIComponent(postId))
      setMessage('Post link copied.')
    } catch {
      setMessage('Could not copy the link. Please try again.')
    }
  }
  return <>
    <button type="button" onClick={handleCopy} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800">Copy link</button>
    {message ? <p role="status" className="basis-full text-sm text-zinc-300">{message}</p> : null}
  </>
}
