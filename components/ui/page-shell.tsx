import type { ReactNode } from 'react'
type PageShellProps = { children: ReactNode; maxWidth?: '4xl' | '5xl' | '6xl' | '7xl'; className?: string }
const widths = { '4xl': 'max-w-4xl', '5xl': 'max-w-5xl', '6xl': 'max-w-6xl', '7xl': 'max-w-7xl' }
export function PageShell({ children, maxWidth = '6xl', className = '' }: PageShellProps) {
  return <div className={`mx-auto w-full min-w-0 space-y-6 ${widths[maxWidth]} ${className}`}>{children}</div>
}
