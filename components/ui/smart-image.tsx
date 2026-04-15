'use client'

import { useEffect, useMemo, useState } from 'react'
import { MediaSkeleton } from '@/components/ui/media-skeleton'

type SmartImageProps = {
  src?: string | null
  alt: string
  className: string
  fallbackClassName?: string
  fallbackText?: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'auto' | 'high' | 'low'
}

function isProbablyRenderableUrl(value: string) {
  if (!value) return false
  if (value.startsWith('blob:')) return true
  if (value.startsWith('data:image/')) return true

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackText = 'Media',
  loading = 'lazy',
  fetchPriority = 'auto',
}: SmartImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const normalizedSrc = useMemo(() => String(src || '').trim(), [src])
  const shouldRender = isProbablyRenderableUrl(normalizedSrc)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)

    if (!shouldRender) return

    const image = new window.Image()
    image.decoding = 'async'
    image.loading = loading
    image.src = normalizedSrc

    if (image.complete) {
      setLoaded(true)
      return
    }

    const handleLoad = () => setLoaded(true)
    const handleError = () => setFailed(true)

    image.addEventListener('load', handleLoad)
    image.addEventListener('error', handleError)

    return () => {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
    }
  }, [normalizedSrc, shouldRender, loading])

  if (!shouldRender || failed) {
    return (
      <div className={fallbackClassName || className}>
        <span>{fallbackText}</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded ? <MediaSkeleton className="absolute inset-0 h-full w-full" /> : null}

      <img
        src={normalizedSrc}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        referrerPolicy="no-referrer"
        className={`h-full w-full object-cover transition duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}