import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

type SurfaceHeroAction = {
  href: string
  label: string
  variant?: 'primary' | 'secondary'
}

type SurfaceHeroStat = {
  label: string
  value: string | number
  helper?: string
}

type SurfaceHeroProps = {
  eyebrow: string
  title: string
  description: string
  actions?: SurfaceHeroAction[]
  stats?: SurfaceHeroStat[]
}

export function SurfaceHero({
  eyebrow,
  title,
  description,
  actions = [],
  stats = [],
}: SurfaceHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[36px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,24,0.96),rgba(7,7,10,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.06),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />

      <div className="relative px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100 shadow-[0_10px_28px_rgba(120,119,255,0.12)]">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </div>

            <h1 className="mt-5 bg-[linear-gradient(90deg,#ffffff_0%,#dedfff_45%,#ffffff_100%)] bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              {description}
            </p>

            {actions.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {actions.map((action) => {
                  const primary = action.variant === 'primary'

                  return (
                    <Link
                      key={`${action.href}-${action.label}`}
                      href={action.href}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                        primary
                          ? 'border-white bg-white text-black shadow-[0_16px_38px_rgba(255,255,255,0.10)] hover:-translate-y-0.5 hover:opacity-90'
                          : 'border-zinc-700 bg-zinc-950/85 text-zinc-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      {action.label}
                      {primary ? <ArrowRight className="h-4 w-4" /> : null}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>

          {stats.length > 0 ? (
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-[520px]">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 px-4 py-4 shadow-[0_14px_30px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950/90"
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                  {stat.helper ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{stat.helper}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}