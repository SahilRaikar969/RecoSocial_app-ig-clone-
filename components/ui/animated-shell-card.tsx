import type { ReactNode } from 'react'

type AnimatedShellCardProps = {
  children: ReactNode
  className?: string
}

export function AnimatedShellCard({
  children,
  className = '',
}: AnimatedShellCardProps) {
  return (
    <div className={`transition-transform duration-200 ease-out md:hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  )
}