import { PageShell } from '@/components/ui/page-shell'
import { MediaSkeleton } from '@/components/ui/media-skeleton'

export default function ExploreLoading() {
  return (
    <PageShell maxWidth="5xl">
      <p role="status" className="sr-only">Loading discovery…</p>
      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="h-6 w-28 rounded-full bg-zinc-900" />
        <div className="mt-4 h-10 w-40 rounded bg-zinc-900" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-zinc-950" />

        <div className="mt-6 flex gap-3 overflow-hidden">
          <div className="h-10 w-24 rounded-full bg-zinc-900" />
          <div className="h-10 w-24 rounded-full bg-zinc-950" />
          <div className="h-10 w-24 rounded-full bg-zinc-950" />
          <div className="h-10 w-24 rounded-full bg-zinc-950" />
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