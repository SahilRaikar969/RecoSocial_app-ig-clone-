'use client'

import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { useTransition } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

export default function RouteError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <section className="w-full rounded-xl border border-zinc-800/90 bg-black p-8 text-center  sm:p-10">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-900/50 bg-amber-950/30 px-4 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          Unable to load
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white ">
          This page could not load
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
          Try loading this page again, or continue to your feed or Explore.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => startTransition(() => retry())}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white bg-white px-5 py-4 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <RefreshCcw className="h-4 w-4" />
            {isPending ? 'Retrying…' : 'Try again'}
          </button>

          <Link
            href="/feed"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to feed
          </Link>

          <Link
            href="/explore"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Open explore
          </Link>
        </div>
        <p role="status" className="sr-only">{isPending ? 'Reloading this page…' : ''}</p>
      </section>
    </div>
  )
}
