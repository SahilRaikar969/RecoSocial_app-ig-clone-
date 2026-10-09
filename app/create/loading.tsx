import { PageShell } from '@/components/ui/page-shell'
import { MediaSkeleton } from '@/components/ui/media-skeleton'

export default function CreateLoading() {
  return (
    <PageShell maxWidth="4xl">
      <p role="status" className="sr-only">Loading post editor…</p>
      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="h-6 w-24 rounded-full bg-zinc-900" />
        <div className="mt-4 h-10 w-40 rounded bg-zinc-900" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-zinc-950" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <MediaSkeleton className="aspect-[4/5] w-full rounded-[24px]" />

          <div className="space-y-4">
            <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="h-4 w-28 rounded bg-zinc-900" />
              <div className="mt-4 h-24 w-full rounded-2xl bg-black" />
            </div>

            <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="h-4 w-24 rounded bg-zinc-900" />
              <div className="mt-4 h-10 w-full rounded-2xl bg-black" />
            </div>

            <div className="h-12 w-full rounded-2xl bg-zinc-900" />
          </div>
        </div>
      </section>
    </PageShell>
  )
}