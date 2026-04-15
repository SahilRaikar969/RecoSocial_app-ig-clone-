'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-12">
          <section className="w-full rounded-[36px] border border-zinc-800/90 bg-black p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-10">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-900/50 bg-amber-950/30 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              App error
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Something broke on this surface
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              The page failed to render correctly. Reload the current route or return to a stable product surface.
            </p>

            {error?.message ? (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-4 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Error message
                </p>
                <p className="mt-2 break-words text-sm leading-7 text-zinc-300">
                  {error.message}
                </p>
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white bg-white px-5 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                <RefreshCcw className="h-4 w-4" />
                Try again
              </button>

              <Link
                href="/feed"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Back to feed
              </Link>

              <Link
                href="/explore"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open explore
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}