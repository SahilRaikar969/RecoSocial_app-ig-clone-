import Link from 'next/link'

type ProfileSurfaceTab = {
  key: string
  label: string
  href: string
  count: number
  active: boolean
}

type ProfileSurfaceTabsProps = {
  tabs: readonly ProfileSurfaceTab[]
}

export function ProfileSurfaceTabs({ tabs }: ProfileSurfaceTabsProps) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(16,16,22,0.96),rgba(8,8,10,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.12),transparent_30%)]" />

      <div className="-mx-4 overflow-x-auto px-4 py-4 sm:mx-0 sm:px-5">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`group inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-semibold transition sm:min-w-[104px] sm:gap-2 sm:px-4 ${
                tab.active
                  ? 'border-violet-400/20 bg-violet-500/12 text-white shadow-[0_12px_30px_rgba(120,119,255,0.12)]'
                  : 'border-zinc-700 bg-zinc-950/85 text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:text-white'
              }`}
            >
              <span className="truncate text-[13px] sm:text-sm">{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none sm:px-2 ${
                  tab.active
                    ? 'bg-white/10 text-white'
                    : 'bg-black/50 text-zinc-400 group-hover:text-zinc-200'
                }`}
              >
                {tab.count}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}