import { MediaSkeleton } from '@/components/ui/media-skeleton'

type RouteLoadingProps = {
  label: string
  media?: boolean
}

export function RouteLoading({ label, media = false }: RouteLoadingProps) {
  return (
    <section aria-busy="true" className="mx-auto w-full max-w-5xl rounded-[32px] border border-zinc-800/90 bg-black p-5 sm:p-6">
      <p role="status" className="text-sm text-zinc-400">{label}</p>
      <div aria-hidden="true" className="mt-5 space-y-4">
        <div className="h-8 w-48 rounded bg-zinc-900 motion-safe:animate-pulse" />
        {media ? <MediaSkeleton className="aspect-[4/5] w-full max-w-lg rounded-[24px]" /> : (
          <div className="space-y-3">
            <div className="h-24 rounded-[24px] bg-zinc-900 motion-safe:animate-pulse" />
            <div className="h-24 rounded-[24px] bg-zinc-900 motion-safe:animate-pulse" />
            <div className="h-24 rounded-[24px] bg-zinc-900 motion-safe:animate-pulse" />
          </div>
        )}
      </div>
    </section>
  )
}
