'use client'

import { useState } from 'react'

type CopyProfileLinkButtonProps = { profileId: string; className?: string }

export function CopyProfileLinkButton({ profileId, className = '' }: CopyProfileLinkButtonProps) {
  const [message, setMessage] = useState('')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/profile/' + encodeURIComponent(profileId))
      setMessage('Profile link copied.')
    } catch {
      setMessage('Could not copy the link. Please try again.')
    }
  }

  return <>
    <button type="button" onClick={handleCopy}
      className={'inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 ' + className}>Copy link</button>
    {message ? <p role="status" className="basis-full text-sm text-zinc-300">{message}</p> : null}
  </>
}
