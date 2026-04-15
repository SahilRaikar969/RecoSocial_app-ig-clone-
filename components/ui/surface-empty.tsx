import Link from 'next/link'
import { Sparkles } from 'lucide-react'

type SurfaceEmptyAction = {
  href: string
  label: string
}

type SurfaceEmptyProps = {
  eyebrow: string
  title: string
  body: string
  actions?: SurfaceEmptyAction[]
}

export function SurfaceEmpty({
  eyebrow,
  title,
  body,
  actions = [],
}: SurfaceEmptyProps) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-dashed border-zinc-800 bg-[linear-gradient(180deg,rgba(16,16,24,0.94),rgba(7,7,10,0.98))] px-6 py-12 text-center shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

      <div className="relative mx-auto max-w-2xl">
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

        {actions.length > 0 ? (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {actions.map((action, index) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                  index === 0
                    ? 'border-white bg-white text-black hover:-translate-y-0.5 hover:opacity-90'
                    : 'border-zinc-700 bg-zinc-950/85 text-zinc-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}