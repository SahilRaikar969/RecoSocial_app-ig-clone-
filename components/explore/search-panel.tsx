'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

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
  const [isPending, startTransition] = useTransition()

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
    startTransition(() => router.push(finalQuery ? `/explore?${finalQuery}` : '/explore'))
  }

  function handleClear() {
    if (activeCategory) {
      startTransition(() => router.push(`/explore?category=${encodeURIComponent(activeCategory)}`))
      setQuery('')
      return
    }

    startTransition(() => router.push('/explore'))
    setQuery('')
  }

  return (
    <form role="search" aria-label="Explore search" aria-busy={isPending} onSubmit={handleSubmit}>
      <label htmlFor="explore-search" className="sr-only">Search creators and captions</label>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-44">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <input id="explore-search" name="q" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search creators and captions" className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-3 text-base text-white placeholder:text-zinc-400" />
        </div>
        <button type="submit" disabled={isPending} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">{isPending ? 'Searching…' : 'Search'}</button>
        {query.trim() ? <button type="button" onClick={handleClear} aria-label="Clear search" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-700 px-3 text-zinc-300 hover:bg-zinc-800"><X aria-hidden="true" className="h-5 w-5" /></button> : null}
      </div>
      <span role="status" className="sr-only">{isPending ? 'Loading search results…' : ''}</span>
    </form>
  )
}
