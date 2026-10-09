import { PageShell } from '@/components/ui/page-shell'
import { MediaSkeleton } from '@/components/ui/media-skeleton'

export default function ProfileLoading() {
  return (
    <PageShell maxWidth="5xl">
      <p role="status" className="sr-only">Loading profile…</p>
      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="h-24 w-24 rounded-full bg-zinc-900 sm:h-36 sm:w-36" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-3">
              <div className="h-10 w-40 rounded bg-zinc-900" />
              <div className="h-10 w-28 rounded-2xl bg-zinc-950" />
              <div className="h-10 w-32 rounded-2xl bg-zinc-950" />
            </div>

            <div className="mt-6 flex gap-6">
              <div className="h-8 w-16 rounded bg-zinc-900" />
              <div className="h-8 w-16 rounded bg-zinc-900" />
              <div className="h-8 w-16 rounded bg-zinc-900" />
            </div>

            <div className="mt-6 h-4 w-32 rounded bg-zinc-900" />
            <div className="mt-3 h-4 w-48 rounded bg-zinc-950" />

            <div className="mt-6 flex gap-3 overflow-hidden">
              <div className="h-20 w-20 rounded-full bg-zinc-950" />
              <div className="h-20 w-20 rounded-full bg-zinc-950" />
              <div className="h-20 w-20 rounded-full bg-zinc-950" />
              <div className="h-20 w-20 rounded-full bg-zinc-950" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
          {Array.from({ length: 12 }).map((_, index) => (
            <MediaSkeleton key={index} className="aspect-square w-full rounded-[10px]" />
          ))}
        </div>
      </section>
    </PageShell>
  )
}