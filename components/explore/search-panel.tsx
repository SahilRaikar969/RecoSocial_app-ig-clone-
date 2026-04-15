'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'

type SearchPanelProps = {
  initialQuery?: string
  activeCategory?: string
}

export function SearchPanel({
  initialQuery = '',
  activeCategory = '',
}: SearchPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)

  const hasAnyFilter = useMemo(
    () => Boolean(query.trim() || activeCategory),
    [query, activeCategory]
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const params = new URLSearchParams(searchParams.toString())

    if (query.trim()) {
      params.set('q', query.trim())
    } else {
      params.delete('q')
    }

    if (!activeCategory) {
      params.delete('category')
    }

    const finalQuery = params.toString()
    router.push(finalQuery ? `/explore?${finalQuery}` : '/explore')
  }

  function handleClear() {
    if (activeCategory) {
      router.push(`/explore?category=${encodeURIComponent(activeCategory)}`)
      setQuery('')
      return
    }

    router.push('/explore')
    setQuery('')
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_26%)]" />

      <div className="relative px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Discovery controls
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Search and refine
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
              Search creators and captions while keeping the current discovery route intact.
            </p>
          </div>

          {activeCategory ? (
            <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              Active topic: {activeCategory}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search creators, captions, topics..."
                className="w-full rounded-2xl border border-zinc-700 bg-black/75 px-11 py-3.5 text-sm text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] outline-none placeholder:text-zinc-500 transition focus:border-violet-500/30 focus:bg-black focus:shadow-[0_0_0_1px_rgba(120,119,255,0.12),0_18px_45px_rgba(120,119,255,0.08)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-2xl border border-white bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:opacity-90"
              >
                Search
              </button>

              {hasAnyFilter ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/85 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}