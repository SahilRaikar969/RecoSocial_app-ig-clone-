import Link from 'next/link'
import { ArrowLeft, Compass, SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-[36px] border border-zinc-800/90 bg-black p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-10">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          <SearchX className="h-3.5 w-3.5" />
          Not found
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          This surface does not exist
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
          The route may have been removed, the content may no longer be available, or the current link may be incomplete.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link
            href="/feed"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to feed
          </Link>

          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white bg-white px-5 py-4 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Compass className="h-4 w-4" />
            Explore
          </Link>

          <Link
            href="/profile"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Profile
          </Link>
        </div>
      </section>
    </main>
  )
}