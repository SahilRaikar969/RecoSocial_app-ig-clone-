'use client'

import { useMemo, useState } from 'react'

type CopyPostLinkButtonProps = {
  postId: string
}

export function CopyPostLinkButton({ postId }: CopyPostLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  const postUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/post/${postId}`
  }, [postId])

  async function handleCopy() {
    try {
      if (!postUrl) return

      await navigator.clipboard.writeText(postUrl)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
        copied
          ? 'border-white bg-white text-black'
          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
      }`}
    >
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  )
}