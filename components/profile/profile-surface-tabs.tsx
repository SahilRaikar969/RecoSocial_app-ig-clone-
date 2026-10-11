import { NavigationLink as Link } from '@/components/ui/navigation-link'

type ProfileSurfaceTab = { key: string; label: string; href: string; count: number; active: boolean }
type ProfileSurfaceTabsProps = { tabs: readonly ProfileSurfaceTab[] }

export function ProfileSurfaceTabs({ tabs }: ProfileSurfaceTabsProps) {
  return (
    <nav aria-label="Profile collections" className="my-4 overflow-x-auto border-b border-zinc-800" data-disable-camera-swipe="true">
      <div className="flex min-w-max gap-1">
        {tabs.map(tab => <Link key={tab.key} href={tab.href} aria-current={tab.active ? 'page' : undefined}
          className={'inline-flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium ' + (tab.active ? 'border-violet-400 text-white' : 'border-transparent text-zinc-400 hover:border-zinc-600 hover:text-white')}>
          {tab.label}<span className="text-xs text-zinc-400">{tab.count}</span>
        </Link>)}
      </div>
    </nav>
  )
}
