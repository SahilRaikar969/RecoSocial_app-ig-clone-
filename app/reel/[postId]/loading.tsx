export default function ReelLoading() {
  return (
    <div className="fixed inset-0 z-[100] bg-black text-white">
      <div className="flex h-[100svh] w-full items-center justify-center bg-black px-3 py-4 sm:px-4">
        <div className="relative h-full w-full max-w-[430px] overflow-hidden rounded-[28px] border border-zinc-800 bg-black">
          <div className="absolute inset-0 animate-pulse bg-[linear-gradient(180deg,#050505_0%,#0a0a0a_100%)]" />

          <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between">
            <div className="h-10 w-24 rounded-full bg-zinc-900/90" />
            <div className="h-10 w-20 rounded-full bg-zinc-900/90" />
          </div>

          <div className="absolute bottom-8 left-4 right-4 z-10 flex items-end justify-between gap-4">
            <div className="max-w-[72%]">
              <div className="h-12 w-44 rounded-2xl bg-zinc-900/90" />
              <div className="mt-4 h-4 w-64 max-w-full rounded bg-zinc-800/90" />
              <div className="mt-2 h-4 w-48 max-w-full rounded bg-zinc-800/90" />
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-zinc-900/90" />
              <div className="h-3 w-8 rounded bg-zinc-800/90" />
              <div className="h-14 w-14 rounded-full bg-zinc-900/90" />
              <div className="h-3 w-8 rounded bg-zinc-800/90" />
              <div className="h-14 w-14 rounded-full bg-zinc-900/90" />
              <div className="h-3 w-8 rounded bg-zinc-800/90" />
              <div className="h-14 w-14 rounded-full bg-zinc-900/90" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}