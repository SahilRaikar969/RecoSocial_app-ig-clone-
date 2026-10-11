import { NavigationLink as Link } from '@/components/ui/navigation-link'
type SurfaceEmptyProps = { eyebrow: string; title: string; body: string; actions?: { href: string; label: string }[] }
export function SurfaceEmpty({ title, body, actions = [] }: SurfaceEmptyProps) {
  return <section className="rounded-xl border border-zinc-800 px-4 py-10 text-center"><h2 className="text-lg font-semibold text-white">{title}</h2>{body ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">{body}</p> : null}{actions.length ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions.map((action, i) => <Link key={action.href} href={action.href} className={`rs-button ${i === 0 ? 'rs-button-primary' : ''}`}>{action.label}</Link>)}</div> : null}</section>
}
