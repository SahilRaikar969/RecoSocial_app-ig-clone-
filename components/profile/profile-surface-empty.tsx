import { Sparkles } from 'lucide-react'

type ProfileSurfaceEmptyProps = {
  eyebrow: string
  title: string
  body: string
}

export function ProfileSurfaceEmpty({
  eyebrow,
  title,
  body,
}: ProfileSurfaceEmptyProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-dashed border-zinc-800 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] px-6 py-12 text-center shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

      <div className="relative mx-auto max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100">
          <Sparkles className="h-3.5 w-3.5" />
          {eyebrow}
        </div>

        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h2>

        <p className="mt-4 text-sm leading-7 text-zinc-300 sm:text-base">
          {body}
        </p>
      </div>
    </section>
  )
}