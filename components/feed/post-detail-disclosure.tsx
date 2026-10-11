'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'

type PostDetailDisclosureProps = { children: React.ReactNode; defaultOpen?: boolean }

export function PostDetailDisclosure({ children, defaultOpen = false }: PostDetailDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className="mt-4">
      <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-controls={contentId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white">
        <span>{open ? 'Show less' : 'More options'}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <div id={contentId} hidden={!open} className="mt-3 space-y-4 border-t border-zinc-800 pt-4">{children}</div>
    </section>
  )
}
