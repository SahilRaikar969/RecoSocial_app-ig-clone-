'use client'

import { useState } from 'react'

type CopyProfileLinkButtonProps = {
  profileId: string
  className?: string
}

export function CopyProfileLinkButton({
  profileId,
  className = '',
}: CopyProfileLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const url = `${window.location.origin}/profile/${profileId}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-xl border border-zinc-700 bg-zinc-950/85 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900 ${className}`}
    >
      {copied ? 'Copied link' : 'Copy profile link'}
    </button>
  )
}