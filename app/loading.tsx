export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <p role="status" className="sr-only">Loading page…</p>
      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="h-6 w-24 animate-pulse rounded-full bg-zinc-900" />
        <div className="mt-5 h-10 w-full max-w-md animate-pulse rounded-2xl bg-zinc-900" />
        <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-xl bg-zinc-900" />
        <div className="mt-2 h-5 w-full max-w-xl animate-pulse rounded-xl bg-zinc-900" />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-[24px] bg-zinc-900" />
          <div className="h-24 animate-pulse rounded-[24px] bg-zinc-900" />
          <div className="h-24 animate-pulse rounded-[24px] bg-zinc-900" />
        </div>
      </section>

      <section className="mt-6 rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="mb-6 h-7 w-56 animate-pulse rounded-2xl bg-zinc-900" />

        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950/80">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-900" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-40 animate-pulse rounded-xl bg-zinc-900" />
                <div className="mt-2 h-3 w-28 animate-pulse rounded-xl bg-zinc-900" />
              </div>
            </div>

            <div className="aspect-[4/5] animate-pulse bg-zinc-900" />

            <div className="space-y-3 px-4 py-4">
              <div className="h-4 w-32 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-4 w-full animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-4 w-5/6 animate-pulse rounded-xl bg-zinc-900" />
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950/80">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-900" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-36 animate-pulse rounded-xl bg-zinc-900" />
                <div className="mt-2 h-3 w-24 animate-pulse rounded-xl bg-zinc-900" />
              </div>
            </div>

            <div className="aspect-[4/5] animate-pulse bg-zinc-900" />

            <div className="space-y-3 px-4 py-4">
              <div className="h-4 w-28 animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-4 w-full animate-pulse rounded-xl bg-zinc-900" />
              <div className="h-4 w-4/6 animate-pulse rounded-xl bg-zinc-900" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}