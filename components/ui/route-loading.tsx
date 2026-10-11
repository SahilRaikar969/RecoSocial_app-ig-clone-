import { MediaSkeleton } from '@/components/ui/media-skeleton'
export function RouteLoading({ label, media = false }: { label: string; media?: boolean }) {
  return <section aria-busy="true" className="mx-auto w-full max-w-3xl space-y-5 py-3"><p role="status" className="text-sm text-zinc-400">{label}</p><div aria-hidden="true" className="space-y-4"><MediaSkeleton className="h-8 w-40 rounded-lg" />{media ? <MediaSkeleton className="aspect-[4/5] w-full max-w-lg rounded-xl" /> : <><MediaSkeleton className="h-24 rounded-xl" /><MediaSkeleton className="h-24 rounded-xl" /><MediaSkeleton className="h-24 rounded-xl" /></>}</div></section>
}
