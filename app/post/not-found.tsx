import Link from 'next/link'

export default function PostNotFound() {
  return (
    <main className="mx-auto max-w-3xl">
      <section className="rounded-[32px] border border-zinc-800/90 bg-zinc-950/90 px-6 py-8">
        <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          Post
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Post not found
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          The requested post does not exist or is no longer available in the current dataset.
        </p>

        <div className="mt-6">
          <Link
            href="/feed"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Return to Feed
          </Link>
        </div>
      </section>
    </main>
  )
}