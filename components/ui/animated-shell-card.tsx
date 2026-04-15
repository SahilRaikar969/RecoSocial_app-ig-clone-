'use client'

import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}