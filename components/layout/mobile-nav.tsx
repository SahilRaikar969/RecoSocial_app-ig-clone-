'use client'

import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { usePathname } from 'next/navigation'
import { primaryNavigation, isActivePath } from './navigation-items'

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-700 bg-[#18181b] px-1 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] md:hidden">
      {primaryNavigation.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href)
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium ${active ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-300 hover:bg-zinc-800'}`}><Icon aria-hidden="true" className="h-5 w-5" /><span>{label}</span></Link>
      })}
    </nav>
  )
}
