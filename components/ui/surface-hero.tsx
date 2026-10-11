import { NavigationLink as Link } from '@/components/ui/navigation-link'
type SurfaceHeroAction = { href: string; label: string; variant?: 'primary' | 'secondary' }
type SurfaceHeroStat = { label: string; value: string | number; helper?: string }
type SurfaceHeroProps = { eyebrow?: string; title: string; description?: string; actions?: SurfaceHeroAction[]; stats?: SurfaceHeroStat[] }
export function SurfaceHero({ eyebrow, title, description, actions = [], stats = [] }: SurfaceHeroProps) {
  return <header className="space-y-4 border-b border-zinc-800 pb-5">
    {eyebrow && eyebrow !== title ? <p className="text-sm text-zinc-400">{eyebrow}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>{actions.length ? <div className="flex flex-wrap gap-2">{actions.map(action => <Link key={action.href + action.label} href={action.href} className={`rs-button ${action.variant === 'primary' ? 'rs-button-primary' : ''}`}>{action.label}</Link>)}</div> : null}</div>
    {description ? <p className="max-w-2xl text-sm leading-6 text-zinc-400">{description}</p> : null}
    {stats.length ? <dl className="flex flex-wrap gap-x-6 gap-y-2">{stats.map(stat => <div key={stat.label} className="flex gap-2 text-sm"><dt className="text-zinc-400">{stat.label}</dt><dd className="font-semibold text-white">{stat.value}</dd></div>)}</dl> : null}
  </header>
}
