import { PageShell } from '@/components/ui/page-shell'

function ActivityRowSkeleton() {
  return (
    <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-zinc-900" />
          <div className="min-w-0">
            <div className="h-4 w-40 rounded bg-zinc-900" />
            <div className="mt-3 h-4 w-64 max-w-full rounded bg-zinc-950" />
            <div className="mt-2 h-4 w-48 max-w-full rounded bg-zinc-950" />
          </div>
        </div>
        <div className="h-20 w-20 rounded-[16px] bg-zinc-900" />
      </div>
    </div>
  )
}

export default function ActivityLoading() {
  return (
    <PageShell maxWidth="5xl">
      <section className="rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
        <div className="h-6 w-24 rounded-full bg-zinc-900" />
        <div className="mt-4 h-10 w-44 rounded bg-zinc-900" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-zinc-950" />
      </section>

      <div className="space-y-4">
        <ActivityRowSkeleton />
        <ActivityRowSkeleton />
        <ActivityRowSkeleton />
      </div>
    </PageShell>
  )
}