import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
  maxWidth?: '4xl' | '5xl' | '6xl' | '7xl'
  className?: string
}

function getMaxWidthClass(maxWidth: NonNullable<PageShellProps['maxWidth']>) {
  switch (maxWidth) {
    case '4xl':
      return 'max-w-4xl'
    case '5xl':
      return 'max-w-5xl'
    case '7xl':
      return 'max-w-7xl'
    default:
      return 'max-w-6xl'
  }
}

export function PageShell({
  children,
  maxWidth = '6xl',
  className = '',
}: PageShellProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[40px]">
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute right-0 top-24 h-56 w-56 rounded-full bg-pink-500/10 blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-400/6 blur-[110px]" />
      </div>

      <main
        className={`mx-auto w-full ${getMaxWidthClass(maxWidth)} px-4 py-4 sm:px-6 sm:py-6`}
      >
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  )
}