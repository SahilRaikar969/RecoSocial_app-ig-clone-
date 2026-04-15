'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type AnimatedLinkButtonProps = {
  href: string
  className: string
  children: ReactNode
}

const MotionLink = motion.create(Link)

export function AnimatedLinkButton({
  href,
  className,
  children,
}: AnimatedLinkButtonProps) {
  return (
    <MotionLink
      href={href}
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </MotionLink>
  )
}