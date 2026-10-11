import type { ReactNode } from 'react'
export function AnimatedShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
