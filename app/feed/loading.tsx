import { PageShell } from '@/components/ui/page-shell'
import { MediaSkeleton } from '@/components/ui/media-skeleton'

function FeedCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-zinc-800/90 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-zinc-900" />
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-zinc-900" />
            <div className="h-3 w-20 rounded bg-zinc-950" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-full bg-zinc-900" />
      </div>

      <MediaSkeleton className="aspect-[4/5] w-full" />

      <div className="space-y-4 px-4 pb-5 pt-4 sm:px-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div className="h-11 w-11 rounded-full bg-zinc-900" />
            <div className="h-11 w-11 rounded-full bg-zinc-900" />
            <div className="h-11 w-11 rounded-full bg-zinc-900" />
          </div>
          <div className="h-11 w-11 rounded-full bg-zinc-900" />
        </div>

        <div className="h-4 w-24 rounded bg-zinc-900" />
        <div className="h-4 w-full rounded bg-zinc-950" />
        <div className="h-4 w-3/4 rounded bg-zinc-950" />
      </div>
    </div>
  )
}

export default function FeedLoading() {
  return (
    <PageShell maxWidth="5xl">
      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="h-6 w-32 rounded-full bg-zinc-900" />
        <div className="mt-4 h-10 w-48 rounded bg-zinc-900" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-zinc-950" />
        <div className="mt-2 h-4 w-4/5 max-w-xl rounded bg-zinc-950" />

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="h-3 w-20 rounded bg-zinc-900" />
            <div className="mt-3 h-7 w-12 rounded bg-zinc-900" />
            <div className="mt-3 h-4 w-full rounded bg-zinc-950" />
          </div>
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="h-3 w-20 rounded bg-zinc-900" />
            <div className="mt-3 h-7 w-12 rounded bg-zinc-900" />
            <div className="mt-3 h-4 w-full rounded bg-zinc-950" />
          </div>
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="h-3 w-20 rounded bg-zinc-900" />
            <div className="mt-3 h-7 w-12 rounded bg-zinc-900" />
            <div className="mt-3 h-4 w-full rounded bg-zinc-950" />
          </div>
        </div>
      </section>

      <div className="space-y-8">
        <FeedCardSkeleton />
        <FeedCardSkeleton />
      </div>
    </PageShell>
  )
}