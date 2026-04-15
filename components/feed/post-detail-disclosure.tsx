'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'

type PostDetailDisclosureProps = {
  children: React.ReactNode
  defaultOpen?: boolean
}

export function PostDetailDisclosure({
  children,
  defaultOpen = false,
}: PostDetailDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
        className={`group flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
          open
            ? 'border-violet-400/20 bg-violet-500/10 text-white shadow-[0_14px_30px_rgba(120,119,255,0.10)]'
            : 'border-zinc-800 bg-black/55 text-zinc-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-black/70 hover:text-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`h-2.5 w-2.5 rounded-full transition ${
              open ? 'bg-violet-300 shadow-[0_0_16px_rgba(167,139,250,0.8)]' : 'bg-zinc-500'
            }`}
          />
          <span>{open ? 'Show less' : 'Show more'}</span>
        </div>

        <div className="flex items-center gap-2 text-zinc-300 group-hover:text-white">
          <span className="hidden text-xs font-medium sm:inline">
            {open ? 'Hide details' : 'Open details'}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
        </div>
      </button>

      <div
        id={contentId}
        className={`grid transition-all duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-5 rounded-[26px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(14,14,18,0.92),rgba(8,8,10,0.96))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}